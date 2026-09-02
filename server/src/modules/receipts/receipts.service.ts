import { TxStatus, TxType } from "@prisma/client"
import { randomInt } from "node:crypto"

import { env } from "../../config/env.js"
import { generateToken } from "../../lib/crypto.js"
import { NotFoundError, ValidationError } from "../../lib/errors.js"
import { serialize } from "../../lib/money.js"
import { prisma } from "../../lib/prisma.js"
import { recordAudit } from "../../services/audit.service.js"

/**
 * A receipt is proof handed to someone outside the platform, so two properties
 * matter more than anything else here.
 *
 * **It never changes.** Issuing is idempotent: the second call returns the
 * reference and URL the first one minted. A receipt whose number moved after it
 * was forwarded to a bank or an accountant would be worse than no receipt.
 *
 * **It says as little as possible.** The page is reachable by anyone holding
 * the link, so it carries the amount, the date and who the account belongs to —
 * and deliberately not the balance. A client forwarding proof of one payment
 * should not be disclosing what else is in their account.
 */

/** Unambiguous in handwriting and over the phone — no I/O/0/1. */
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

function referenceFor(date: Date): string {
  const yy = String(date.getUTCFullYear()).slice(2)
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0")
  let tail = ""
  for (let i = 0; i < 6; i += 1) {
    tail += REF_ALPHABET[randomInt(0, REF_ALPHABET.length)]
  }
  return `SET-${yy}${mm}-${tail}`
}

export interface ReceiptLink {
  reference: string
  token: string
  url: string
  issuedAt: Date
  /** False when this call returned a receipt that already existed. */
  created: boolean
}

function urlFor(token: string): string {
  return `${env.APP_URL.replace(/\/$/, "")}/receipt/${token}`
}

/**
 * Issues the receipt for a transaction, or returns the existing one.
 *
 * Only COMPLETED transactions qualify. A receipt for a pending movement would
 * be a promise rather than a record, and the whole point of the document is
 * that the money has already moved.
 */
export async function issueReceipt(params: {
  transactionId: string
  adminId: string
  ip?: string | undefined
}): Promise<ReceiptLink> {
  const transaction = await prisma.transaction.findUnique({
    where: { id: params.transactionId },
  })
  if (!transaction) throw new NotFoundError("Transaction")

  if (transaction.status !== TxStatus.COMPLETED) {
    throw new ValidationError(
      "A receipt can only be issued for a completed transaction."
    )
  }

  if (transaction.receiptToken && transaction.receiptRef) {
    return {
      reference: transaction.receiptRef,
      token: transaction.receiptToken,
      url: urlFor(transaction.receiptToken),
      issuedAt: transaction.receiptIssuedAt ?? transaction.updatedAt,
      created: false,
    }
  }

  const token = generateToken(24)
  const issuedAt = new Date()

  // The reference is random rather than sequential, so a retry loop is the
  // honest way to handle the vanishingly rare collision the unique index would
  // otherwise turn into a 500.
  let updated = null
  for (let attempt = 0; attempt < 5 && !updated; attempt += 1) {
    const reference = referenceFor(transaction.createdAt)
    try {
      updated = await prisma.transaction.update({
        where: { id: transaction.id },
        data: { receiptToken: token, receiptRef: reference, receiptIssuedAt: issuedAt },
      })
    } catch (error) {
      const code = (error as { code?: string }).code
      // P2002 is the unique violation. Anything else is a real failure.
      if (code !== "P2002") throw error
    }
  }

  if (!updated?.receiptRef || !updated.receiptToken) {
    throw new ValidationError("Could not allocate a receipt reference. Try again.")
  }

  await recordAudit({
    actorId: params.adminId,
    action: "receipt.issue",
    targetType: "Transaction",
    targetId: transaction.id,
    after: { reference: updated.receiptRef },
    ip: params.ip,
  })

  return {
    reference: updated.receiptRef,
    token: updated.receiptToken,
    url: urlFor(updated.receiptToken),
    issuedAt,
    created: true,
  }
}

export interface PublicReceipt {
  reference: string
  issuedAt: Date
  direction: "CREDIT" | "DEBIT"
  amount: string
  category: string
  description: string | null
  status: string
  date: Date
  account: { name: string; uid: string }
}

/**
 * The public view. Looked up by the unguessable token only — there is no
 * endpoint that lists receipts or resolves one from a transaction id, so the
 * link is the entire capability.
 */
export async function getReceiptByToken(token: string): Promise<PublicReceipt> {
  const transaction = await prisma.transaction.findUnique({
    where: { receiptToken: token },
    include: { user: { select: { fullName: true, uid: true } } },
  })

  if (!transaction?.receiptRef) throw new NotFoundError("Receipt")

  return {
    reference: transaction.receiptRef,
    issuedAt: transaction.receiptIssuedAt ?? transaction.updatedAt,
    direction: transaction.type === TxType.CREDIT ? "CREDIT" : "DEBIT",
    amount: serialize(transaction.amount),
    category: transaction.category,
    description: transaction.description,
    status: transaction.status,
    date: transaction.createdAt,
    account: {
      name: transaction.user.fullName,
      uid: transaction.user.uid,
    },
  }
}
