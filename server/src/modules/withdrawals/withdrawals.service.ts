import {
  Prisma,
  RequestStatus,
  TxCategory,
  TxStatus,
  TxType,
  WithdrawalMethod,
  type WithdrawalRequest,
} from "@prisma/client"

import { env } from "../../config/env.js"
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../lib/errors.js"
import { logger } from "../../lib/logger.js"
import { percentOf, round2, serialize, toMoney } from "../../lib/money.js"
import { prisma } from "../../lib/prisma.js"
import {
  sendWithdrawalApprovedEmail,
  sendWithdrawalCancelledEmail,
  sendWithdrawalRejectedEmail,
  sendWithdrawalSubmittedEmail,
} from "../../services/email/email.service.js"
import { recordAudit } from "../../services/audit.service.js"
import {
  getBalanceSnapshot,
  settle,
  unwind,
} from "../../services/ledger.service.js"
import { consumePin } from "../pins/pins.service.js"
import type { CreateWithdrawalInput } from "./withdrawals.schema.js"

/**
 * Withdrawal flow.
 *
 * SwiftEdge's version had three independent defects:
 *  1. It never verified the PIN — `pinVerified: true` was hardcoded into the
 *     transaction metadata, so a client could skip /verify-pin entirely.
 *  2. It reserved nothing, so a user with $1,000 could submit ten $900
 *     requests that each passed the balance check independently.
 *  3. Approval mutated a derived `totalBalance` column that the next portfolio
 *     load recomputed — so the money came straight back.
 *
 * Here the PIN is consumed, the balance re-checked, and the reserving debit
 * inserted inside a single database transaction.
 */

function assertDestination(input: CreateWithdrawalInput): Prisma.InputJsonValue {
  if (input.method === WithdrawalMethod.CRYPTO) {
    if (!input.walletAddress || !input.network) {
      throw new ValidationError(
        "A wallet address and network are required for crypto withdrawals."
      )
    }
    return {
      walletAddress: input.walletAddress,
      network: input.network,
      currency: input.currency ?? null,
    }
  }

  if (!input.bankName || !input.accountNumber || !input.accountName) {
    throw new ValidationError(
      "Bank name, account name and account number are required for bank withdrawals."
    )
  }
  return {
    bankName: input.bankName,
    accountName: input.accountName,
    accountNumber: input.accountNumber,
    routingNumber: input.routingNumber ?? null,
    swiftCode: input.swiftCode ?? null,
  }
}

export async function createWithdrawal(
  userId: string,
  input: CreateWithdrawalInput
): Promise<WithdrawalRequest> {
  const amount = round2(toMoney(input.amount))

  if (amount.lessThan(env.MIN_WITHDRAWAL_USD)) {
    throw new ValidationError(
      `The minimum withdrawal is $${env.MIN_WITHDRAWAL_USD.toFixed(2)}.`
    )
  }

  const destination = assertDestination(input)
  const fee = percentOf(amount, env.WITHDRAWAL_FEE_PERCENT)
  const total = round2(amount.add(fee))

  const request = await prisma.$transaction(
    async (tx) => {
      // Serialise concurrent withdrawals for this account.
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM users WHERE id = ${userId} FOR UPDATE
      `
      if (locked.length === 0) throw new NotFoundError("User")

      // Consumed atomically — a PIN cannot be spent by two requests.
      await consumePin(tx, userId, input.pin)

      const { available } = await getBalanceSnapshot(userId, tx)
      if (available.lessThan(total)) {
        throw new ValidationError(
          `Insufficient available balance. Withdrawing $${amount.toFixed(2)} costs $${total.toFixed(2)} including the $${fee.toFixed(2)} fee, but only $${available.toFixed(2)} is available.`
        )
      }

      // PENDING debit for the full cost — this is what reserves the funds.
      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: TxType.DEBIT,
          category: TxCategory.WITHDRAWAL,
          amount: total,
          status: TxStatus.PENDING,
          description: `Withdrawal via ${input.method.toLowerCase()}`,
          metadata: {
            netAmount: serialize(amount),
            fee: serialize(fee),
            method: input.method,
            destination,
          },
        },
      })

      return tx.withdrawalRequest.create({
        data: {
          userId,
          amount,
          feeAmount: fee,
          method: input.method,
          destination,
          transactionId: transaction.id,
        },
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
  )

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  void sendWithdrawalSubmittedEmail(
    user,
    serialize(amount),
    serialize(fee),
    input.method
  ).catch((error: unknown) => {
    logger.error({ err: error }, "Withdrawal submitted email failed")
  })

  return request
}

export async function listForUser(userId: string) {
  return prisma.withdrawalRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
}

/** A user may cancel their own request while it is still pending. */
export async function cancelWithdrawal(
  userId: string,
  requestId: string
): Promise<void> {
  const request = await prisma.withdrawalRequest.findUnique({
    where: { id: requestId },
    include: { user: true },
  })

  if (!request) throw new NotFoundError("Withdrawal request")
  if (request.userId !== userId) throw new ForbiddenError()
  if (request.status !== RequestStatus.PENDING) {
    throw new ValidationError("Only a pending withdrawal can be cancelled.")
  }

  await prisma.$transaction(async (tx) => {
    await unwind(request.transactionId, TxStatus.CANCELLED, null, tx)
    await tx.withdrawalRequest.update({
      where: { id: requestId },
      data: { status: RequestStatus.CANCELLED },
    })
  })

  // Releasing a hold moves the available balance, so it gets the same paper
  // trail as approve and reject — and doubles as an alert if it wasn't them.
  const { balance } = await getBalanceSnapshot(userId)

  void sendWithdrawalCancelledEmail(
    request.user,
    serialize(request.amount),
    serialize(balance)
  ).catch((error: unknown) => {
    logger.error({ err: error }, "Withdrawal cancelled email failed")
  })
}

export async function processWithdrawal(params: {
  requestId: string
  adminId: string
  action: "approve" | "reject"
  note?: string | undefined
  ip?: string | undefined
}): Promise<void> {
  const request = await prisma.withdrawalRequest.findUnique({
    where: { id: params.requestId },
    include: { user: true },
  })

  if (!request) throw new NotFoundError("Withdrawal request")
  if (request.status !== RequestStatus.PENDING) {
    throw new ValidationError("That withdrawal has already been processed.")
  }

  const approving = params.action === "approve"

  await prisma.$transaction(async (tx) => {
    if (approving) {
      // Flips the reservation into a settled deduction. Because balance is
      // derived from the ledger, nothing can silently restore it later.
      await settle(request.transactionId, params.adminId, tx)
    } else {
      await unwind(
        request.transactionId,
        TxStatus.REJECTED,
        params.adminId,
        tx
      )
    }

    await tx.withdrawalRequest.update({
      where: { id: request.id },
      data: {
        status: approving ? RequestStatus.APPROVED : RequestStatus.REJECTED,
        reviewedById: params.adminId,
        reviewedAt: new Date(),
        reviewNote: params.note ?? null,
      },
    })
  })

  await recordAudit({
    actorId: params.adminId,
    action: approving ? "withdrawal.approve" : "withdrawal.reject",
    targetType: "WithdrawalRequest",
    targetId: request.id,
    after: { status: approving ? "APPROVED" : "REJECTED", note: params.note ?? null },
    ip: params.ip,
  })

  const { balance } = await getBalanceSnapshot(request.userId)

  const email = approving
    ? sendWithdrawalApprovedEmail(
        request.user,
        serialize(request.amount),
        request.method,
        serialize(balance)
      )
    : sendWithdrawalRejectedEmail(
        request.user,
        serialize(request.amount),
        params.note ?? null
      )

  void email.catch((error: unknown) => {
    logger.error({ err: error }, "Withdrawal decision email failed")
  })
}
