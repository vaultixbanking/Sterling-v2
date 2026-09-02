import { PinStatus, type Prisma, type User } from "@prisma/client"

import {
  PIN_ALLOWED_LENGTHS,
  PIN_MAX_TTL_MINUTES,
} from "../../config/constants.js"
import {
  generateNumericPin,
  generateToken,
  hashPassword,
  verifyPassword,
} from "../../lib/crypto.js"
import { InvalidPinError, NotFoundError, ValidationError } from "../../lib/errors.js"
import { prisma } from "../../lib/prisma.js"
import { openSecret, sealSecret } from "../../lib/secret-box.js"

/**
 * Withdrawal PINs.
 *
 * Everything SwiftEdge got wrong here, and how it is handled now:
 *
 *  | SwiftEdge                              | Sterling Edge                    |
 *  |----------------------------------------|----------------------------------|
 *  | No userId — any PIN worked for any user | Bound to one user                |
 *  | Never marked used — infinite replay     | Single-use, consumed atomically  |
 *  | Math.random()                           | crypto.randomInt                 |
 *  | Verified on an unauthenticated route    | Verified inside POST /withdrawals|
 *  | Linear scan + bcrypt compare of ALL pins| Indexed lookup on (userId,status)|
 *  | No TTL bound — a 1-year PIN was legal   | Capped at PIN_MAX_TTL_MINUTES    |
 */

export interface IssuedPin {
  id: string
  /** Raw PIN — returned exactly once, to the issuing admin. */
  pin: string
  expiresAt: Date
  /** Present only when a one-time link was requested at issue time. */
  shareToken?: string
}

export async function issuePin(params: {
  userId: string
  issuedById: string
  length: number
  ttlMinutes: number
  /**
   * Store an encrypted copy behind a one-time link. Off by default and opt-in
   * per issue: without it the bcrypt hash remains the only copy of the PIN
   * anywhere, which is the property worth keeping for every PIN that is simply
   * read out over the phone.
   */
  shareLink?: boolean
}): Promise<IssuedPin> {
  if (!PIN_ALLOWED_LENGTHS.includes(params.length as never)) {
    throw new ValidationError(
      `PIN length must be one of: ${PIN_ALLOWED_LENGTHS.join(", ")}.`
    )
  }

  if (params.ttlMinutes < 1 || params.ttlMinutes > PIN_MAX_TTL_MINUTES) {
    throw new ValidationError(
      `PIN lifetime must be between 1 and ${PIN_MAX_TTL_MINUTES} minutes.`
    )
  }

  const pin = generateNumericPin(params.length)
  const expiresAt = new Date(Date.now() + params.ttlMinutes * 60 * 1000)

  // Only one live PIN per user — issuing a new one supersedes the old.
  const record = await prisma.$transaction(async (tx) => {
    await tx.withdrawalPin.updateMany({
      where: { userId: params.userId, status: PinStatus.ACTIVE },
      data: { status: PinStatus.REVOKED },
    })

    return tx.withdrawalPin.create({
      data: {
        userId: params.userId,
        pinHash: await hashPassword(pin),
        issuedById: params.issuedById,
        expiresAt,
        ...(params.shareLink
          ? { shareToken: generateToken(24), pinCipher: sealSecret(pin) }
          : {}),
      },
    })
  })

  return {
    id: record.id,
    pin,
    expiresAt,
    ...(record.shareToken ? { shareToken: record.shareToken } : {}),
  }
}

/* ------------------------------------------------------- one-time PIN link */

export type ShareState = "READY" | "REVEALED" | "EXPIRED"

export interface PinShareView {
  state: ShareState
  fullName: string
  expiresAt: Date
}

function stateOf(pin: {
  status: PinStatus
  expiresAt: Date
  revealedAt: Date | null
  pinCipher: string | null
}): ShareState {
  if (pin.revealedAt || !pin.pinCipher) return "REVEALED"
  if (pin.status !== PinStatus.ACTIVE || pin.expiresAt <= new Date()) {
    return "EXPIRED"
  }
  return "READY"
}

/**
 * What the link shows before anyone taps Reveal.
 *
 * This is the half a chat app's link-preview crawler fetches, so it must not
 * contain the PIN and must not consume anything. A one-time link that burned on
 * GET would be spent by WhatsApp's fetcher before the recipient ever saw it.
 */
export async function viewPinShare(token: string): Promise<PinShareView> {
  const pin = await prisma.withdrawalPin.findUnique({
    where: { shareToken: token },
    include: { user: { select: { fullName: true } } },
  })
  if (!pin) throw new NotFoundError("Link")

  return {
    state: stateOf(pin),
    fullName: pin.user.fullName,
    expiresAt: pin.expiresAt,
  }
}

/**
 * Spends the link and returns the PIN.
 *
 * The stored ciphertext is cleared in the same update that stamps `revealedAt`,
 * conditioned on it still being unrevealed — so two taps racing each other
 * produce exactly one winner, and a database read after the fact recovers
 * nothing about a PIN that was actually delivered.
 */
export async function revealPinShare(token: string): Promise<string> {
  const pin = await prisma.withdrawalPin.findUnique({
    where: { shareToken: token },
  })
  if (!pin) throw new NotFoundError("Link")

  if (stateOf(pin) !== "READY" || !pin.pinCipher) {
    throw new ValidationError("This link has already been used or has expired.")
  }

  const claimed = await prisma.withdrawalPin.updateMany({
    where: { id: pin.id, revealedAt: null, pinCipher: { not: null } },
    data: { revealedAt: new Date(), pinCipher: null },
  })
  if (claimed.count !== 1) {
    throw new ValidationError("This link has already been used or has expired.")
  }

  const value = openSecret(pin.pinCipher)
  if (!value) {
    throw new ValidationError("This link has already been used or has expired.")
  }

  return value
}

/**
 * Verifies and consumes a PIN in one step.
 *
 * Must be called inside the same transaction that creates the withdrawal, so a
 * PIN cannot be spent twice by two concurrent requests.
 */
export async function consumePin(
  tx: Prisma.TransactionClient,
  userId: string,
  pin: string
): Promise<void> {
  const candidates = await tx.withdrawalPin.findMany({
    where: {
      userId,
      status: PinStatus.ACTIVE,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  })

  for (const candidate of candidates) {
    if (await verifyPassword(pin, candidate.pinHash)) {
      const consumed = await tx.withdrawalPin.updateMany({
        where: { id: candidate.id, status: PinStatus.ACTIVE },
        data: { status: PinStatus.USED, usedAt: new Date() },
      })

      // Lost the race with a concurrent request that used the same PIN.
      if (consumed.count === 0) break

      return
    }
  }

  throw new InvalidPinError()
}

export async function listPins(userId?: string) {
  return prisma.withdrawalPin.findMany({
    where: userId ? { userId } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { uid: true, email: true, fullName: true } },
    },
  })
}

/**
 * @returns the pin's owner when an *active* pin was actually revoked, so the
 *   caller can notify them. Null when the pin was already used, expired or
 *   revoked — re-deleting must not fire a second email.
 */
export async function revokePin(id: string): Promise<User | null> {
  const revoked = await prisma.withdrawalPin.updateMany({
    where: { id, status: PinStatus.ACTIVE },
    data: { status: PinStatus.REVOKED },
  })

  if (revoked.count === 0) return null

  const pin = await prisma.withdrawalPin.findUnique({
    where: { id },
    include: { user: true },
  })

  return pin?.user ?? null
}

/** Housekeeping for the cron job; expiry is also enforced at read time. */
export async function expireStalePins(): Promise<number> {
  const result = await prisma.withdrawalPin.updateMany({
    where: { status: PinStatus.ACTIVE, expiresAt: { lt: new Date() } },
    data: { status: PinStatus.EXPIRED },
  })
  return result.count
}
