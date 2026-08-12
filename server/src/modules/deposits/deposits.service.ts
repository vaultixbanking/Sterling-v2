import {
  DepositMethod,
  RequestStatus,
  TxCategory,
  type DepositRequest,
} from "@prisma/client"

import { env } from "../../config/env.js"
import { NotFoundError, ValidationError } from "../../lib/errors.js"
import { logger } from "../../lib/logger.js"
import { round2, serialize, toMoney } from "../../lib/money.js"
import { prisma } from "../../lib/prisma.js"
import { getProofUrl, uploadProof, type UploadedFile } from "../../lib/storage.js"
import { recordAudit } from "../../services/audit.service.js"
import {
  sendDepositApprovedEmail,
  sendDepositRejectedEmail,
  sendDepositSubmittedEmail,
} from "../../services/email/email.service.js"
import { credit, getBalanceSnapshot } from "../../services/ledger.service.js"

/**
 * User-submitted deposit requests.
 *
 * SwiftEdge had no equivalent: its deposit page showed payment details and a
 * proof upload field that submitted nowhere, and accounts were only ever
 * credited by an admin manually adding a holding or a profit row.
 *
 * Nothing is credited on submission — approval is what creates the ledger entry.
 */

export interface CreateDepositInput {
  amount: number
  method: DepositMethod
  reference?: string | undefined
}

export async function createDeposit(
  userId: string,
  input: CreateDepositInput,
  file?: UploadedFile
): Promise<DepositRequest> {
  const amount = round2(toMoney(input.amount))

  if (amount.lessThan(env.MIN_DEPOSIT_USD)) {
    throw new ValidationError(
      `The minimum deposit is $${env.MIN_DEPOSIT_USD.toFixed(2)}.`
    )
  }

  // Card deposits are handled by support out-of-band, matching current ops.
  if (input.method === DepositMethod.CARD && !input.reference) {
    throw new ValidationError(
      `Card deposits are arranged with our support team. Email ${env.SUPPORT_EMAIL} to get started.`
    )
  }

  const proofPath = file ? await uploadProof(userId, file) : null

  const deposit = await prisma.depositRequest.create({
    data: {
      userId,
      amount,
      method: input.method,
      reference: input.reference?.trim() || null,
      proofPath,
    },
    include: { user: true },
  })

  // Withdrawals acknowledge submission, so deposits must too — otherwise the
  // user hands over money and hears nothing until an admin gets round to it.
  // Fire-and-forget: a mail outage must not fail a deposit that is already
  // recorded, and the request row is the source of truth either way.
  void sendDepositSubmittedEmail(
    deposit.user,
    serialize(deposit.amount),
    depositMethodLabel(deposit.method),
    deposit.reference
  ).catch((error: unknown) => {
    logger.error({ err: error }, "Deposit submitted email failed")
  })

  return deposit
}

/** `BANK_TRANSFER` reads badly in an email. */
function depositMethodLabel(method: DepositMethod): string {
  switch (method) {
    case DepositMethod.BANK_TRANSFER:
      return "Bank transfer"
    case DepositMethod.CRYPTO:
      return "Cryptocurrency"
    case DepositMethod.CARD:
      return "Card"
    default:
      return method
  }
}

export async function listForUser(userId: string) {
  return prisma.depositRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
}

export async function processDeposit(params: {
  requestId: string
  adminId: string
  action: "approve" | "reject"
  note?: string | undefined
  ip?: string | undefined
}): Promise<void> {
  const request = await prisma.depositRequest.findUnique({
    where: { id: params.requestId },
    include: { user: true },
  })

  if (!request) throw new NotFoundError("Deposit request")
  if (request.status !== RequestStatus.PENDING) {
    throw new ValidationError("That deposit has already been processed.")
  }

  const approving = params.action === "approve"

  await prisma.$transaction(async (tx) => {
    let transactionId: string | null = null

    if (approving) {
      const transaction = await credit(
        {
          userId: request.userId,
          amount: request.amount,
          category: TxCategory.DEPOSIT,
          description: `Deposit via ${request.method.toLowerCase().replace(/_/g, " ")}`,
          metadata: {
            method: request.method,
            reference: request.reference,
            depositRequestId: request.id,
          },
          processedById: params.adminId,
        },
        tx
      )
      transactionId = transaction.id
    }

    await tx.depositRequest.update({
      where: { id: request.id },
      data: {
        status: approving ? RequestStatus.APPROVED : RequestStatus.REJECTED,
        reviewedById: params.adminId,
        reviewedAt: new Date(),
        reviewNote: params.note ?? null,
        ...(transactionId ? { transactionId } : {}),
      },
    })
  })

  await recordAudit({
    actorId: params.adminId,
    action: approving ? "deposit.approve" : "deposit.reject",
    targetType: "DepositRequest",
    targetId: request.id,
    after: {
      status: approving ? "APPROVED" : "REJECTED",
      amount: serialize(request.amount),
      note: params.note ?? null,
    },
    ip: params.ip,
  })

  const { balance } = await getBalanceSnapshot(request.userId)

  const email = approving
    ? sendDepositApprovedEmail(
        request.user,
        serialize(request.amount),
        serialize(balance)
      )
    : sendDepositRejectedEmail(
        request.user,
        serialize(request.amount),
        params.note ?? null
      )

  void email.catch((error: unknown) => {
    logger.error({ err: error }, "Deposit decision email failed")
  })
}

/** Payment destinations shown on the deposit page. */
export async function getPaymentMethods() {
  const [bank, crypto, wallets] = await Promise.all([
    prisma.bankAccountConfig.findFirst({ where: { isActive: true } }),
    prisma.cryptoWalletConfig.findMany({
      where: { isActive: true },
      orderBy: { currency: "asc" },
    }),
    prisma.digitalWalletConfig.findMany({
      where: { isActive: true },
      orderBy: { provider: "asc" },
    }),
  ])

  return {
    bank: bank
      ? {
          bankName: bank.bankName,
          accountName: bank.accountName,
          accountNumber: bank.accountNumber,
          routingNumber: bank.routingNumber,
          swiftCode: bank.swiftCode,
        }
      : null,
    crypto: crypto.map((wallet) => ({
      currency: wallet.currency,
      label: wallet.label,
      walletAddress: wallet.walletAddress,
      network: wallet.network,
    })),
    digitalWallets: wallets.map((wallet) => ({
      provider: wallet.provider,
      handle: wallet.handle,
      instructions: wallet.instructions,
    })),
    minimumDeposit: env.MIN_DEPOSIT_USD.toFixed(2),
    supportEmail: env.SUPPORT_EMAIL,
  }
}

/** Signed, short-lived URL — the bucket itself stays private. */
export async function getProofLink(
  requestId: string
): Promise<string | null> {
  const request = await prisma.depositRequest.findUnique({
    where: { id: requestId },
    select: { proofPath: true },
  })

  if (!request?.proofPath) return null
  return getProofUrl(request.proofPath)
}
