import { UserStatus, type User } from "@prisma/client"

import {
  EMAIL_VERIFICATION_TTL_MINUTES,
  RESET_TOKEN_TTL_MINUTES,
} from "../../config/constants.js"
import {
  generateToken,
  generateUid,
  hashPassword,
  hashToken,
  verifyPassword,
} from "../../lib/crypto.js"
import {
  ConflictError,
  ForbiddenError,
  InvalidCredentialsError,
  ValidationError,
} from "../../lib/errors.js"
import { logger } from "../../lib/logger.js"
import { prisma } from "../../lib/prisma.js"
import { describeDevice } from "../../lib/user-agent.js"
import {
  sendEmailVerificationEmail,
  sendLoginAlertEmail,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from "../../services/email/email.service.js"
import { revokeAllSessions } from "./token.service.js"
import { isReserved } from "./username.service.js"
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
} from "./auth.schema.js"

export interface PublicUser {
  id: string
  uid: string
  email: string
  username: string
  fullName: string
  /** E.164. Null only for accounts that predate the requirement. */
  phone: string | null
  /** ISO 3166-1 alpha-2. Same. */
  country: string | null
  role: User["role"]
  status: UserStatus
  createdAt: Date
  lastLoginAt: Date | null
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    uid: user.uid,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    phone: user.phone,
    country: user.country,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  }
}

/** Retries on the astronomically unlikely UID collision. SwiftEdge did not. */
async function allocateUid(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const uid = generateUid()
    const taken = await prisma.user.findUnique({
      where: { uid },
      select: { id: true },
    })
    if (!taken) return uid
  }
  throw new ConflictError("Could not allocate an account reference. Try again.")
}

export async function register(input: RegisterInput): Promise<PublicUser> {
  // These three rules are the ones `checkUsername` reports on. They must stay
  // identical: a name the signup form calls free and then refuses on submit is
  // worse than no live check at all.
  if (isReserved(input.username)) {
    throw new ConflictError("That username is reserved. Please choose another.")
  }

  const [emailTaken, usernameTaken] = await Promise.all([
    prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    }),
    // Case-insensitive: the unique index is byte-for-byte, so without this
    // `Joshua` and `joshua` are two accounts that look like one in every list
    // they appear in — and `login` now treats them as the same handle.
    prisma.user.findFirst({
      where: { username: { equals: input.username, mode: "insensitive" } },
      select: { id: true },
    }),
  ])

  if (emailTaken) {
    throw new ConflictError("An account with that email already exists.")
  }
  if (usernameTaken) {
    throw new ConflictError("That username is already taken.")
  }

  const user = await prisma.user.create({
    data: {
      uid: await allocateUid(),
      email: input.email,
      username: input.username,
      fullName: input.fullName,
      // Already normalised to E.164 and validated against the country by
      // `registerSchema` — this cannot be reached with a number that does not
      // parse, so there is nothing left to defend against here.
      phone: input.phone,
      country: input.country,
      passwordHash: await hashPassword(input.password),
    },
  })

  // Fire-and-forget: a mail outage must not fail registration.
  void sendWelcomeEmail(user).catch((error: unknown) => {
    logger.error({ err: error, userId: user.id }, "Welcome email failed")
  })

  void requestEmailVerification(user.id).catch((error: unknown) => {
    logger.error({ err: error, userId: user.id }, "Verification email failed")
  })

  return toPublicUser(user)
}

/**
 * Issues a fresh confirmation link. Safe to call repeatedly — each call
 * supersedes the previous token, so only the newest link works.
 *
 * Resolves silently for an unknown or already-verified user: this is reachable
 * unauthenticated, and a distinct response would leak which addresses have
 * accounts and which are confirmed.
 */
export async function requestEmailVerification(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || user.emailVerifiedAt) return

  await prisma.emailVerificationToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  })

  const token = generateToken(32)

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(
        Date.now() + EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1000
      ),
    },
  })

  await sendEmailVerificationEmail(user, token, EMAIL_VERIFICATION_TTL_MINUTES)
}

/** Resolves whether or not the address exists — same reasoning as reset. */
export async function requestEmailVerificationByEmail(
  email: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })
  if (!user) return

  await requestEmailVerification(user.id)
}

export async function verifyEmail(token: string): Promise<PublicUser> {
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  })

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new ValidationError(
      "That confirmation link is invalid or has expired. Request a new one."
    )
  }

  // Already confirmed by an earlier link: burn this token and succeed anyway,
  // so clicking a stale email is not an error the user has to interpret.
  if (record.user.emailVerifiedAt) {
    await prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    })
    return toPublicUser(record.user)
  }

  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ])

  return toPublicUser(user)
}

export async function login(
  input: LoginInput
): Promise<User> {
  // Trimmed because mobile keyboards and password managers append a space, and
  // "your password is wrong" is a miserable answer to an invisible character.
  const identifier = input.identifier.trim()

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier.toLowerCase() },
        // Case-insensitive, matching how the address is handled a line above.
        // Only the email was folded, so anyone who registered `Joshua_O` could
        // sign in with their email but never with their own username typed in
        // lower case — and got the same "invalid credentials" as an attacker.
        { username: { equals: identifier, mode: "insensitive" } },
      ],
    },
  })

  // Same error whether the account is missing or the password is wrong.
  // SwiftEdge distinguished the two, which is a free user-enumeration oracle.
  if (!user) {
    throw new InvalidCredentialsError()
  }

  const passwordOk = await verifyPassword(input.password, user.passwordHash)
  if (!passwordOk) {
    throw new InvalidCredentialsError()
  }

  if (user.status === UserStatus.SUSPENDED) {
    throw new ForbiddenError(
      "This account is suspended. Contact support for assistance."
    )
  }

  return user
}

export async function recordLogin(
  userId: string,
  ip: string | undefined
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date(), lastLoginIp: ip ?? null },
  })
}

/**
 * Emails the user when a sign-in comes from a device we have not seen on their
 * account before.
 *
 * Two rules keep this useful rather than noisy:
 *
 *  - **Silent on the first ever session.** With no history there is nothing to
 *    compare against, and "you signed in" is not news to someone who just
 *    signed in for the first time. This also spares the 49 migrated accounts an
 *    alert on their first visit to the new platform.
 *  - **Compares the described device, not the raw agent.** Raw UA strings
 *    change on every browser update, so matching on them would alert roughly
 *    monthly per user until they stopped reading these emails.
 *
 * The lookup must be awaited and must complete BEFORE the new session row is
 * written, or the current login matches itself and nothing ever alerts. Only
 * the send is fire-and-forget — a mail outage must not fail a valid sign-in.
 *
 * @returns Whether an alert was dispatched. The caller ignores it; it exists so
 *   the decision can be tested without mocking the mail layer, which ESM makes
 *   awkward and which would test the mock rather than the rule.
 */
export async function notifyIfNewDevice(
  user: User,
  context: { userAgent?: string | undefined; ip?: string | undefined }
): Promise<boolean> {
  const device = describeDevice(context.userAgent)

  const previous = await prisma.refreshSession.findMany({
    where: { userId: user.id },
    select: { userAgent: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  if (previous.length === 0) return false

  const known = new Set(
    previous.map((session) => describeDevice(session.userAgent) ?? "unknown")
  )

  if (known.has(device ?? "unknown")) return false

  void sendLoginAlertEmail(user, {
    ipAddress: context.ip ?? null,
    device,
  }).catch((error: unknown) => {
    logger.error({ err: error, userId: user.id }, "Login alert email failed")
  })

  return true
}

/**
 * Always resolves, whether or not the address exists. SwiftEdge returned a 404
 * for unknown emails, confirming which addresses had accounts.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return

  // Supersede any outstanding token so only the newest link works.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  })

  const token = generateToken(32)

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
    },
  })

  await sendPasswordResetEmail(user, token)
}

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  })

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new ValidationError("That reset link is invalid or has expired.")
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(newPassword) },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ])

  // A reset is a credential change: every existing session must die.
  await revokeAllSessions(record.userId)

  void sendPasswordChangedEmail(record.user).catch((error: unknown) => {
    logger.error({ err: error }, "Password-changed email failed")
  })
}

export async function changePassword(
  userId: string,
  input: ChangePasswordInput
): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })

  const currentOk = await verifyPassword(
    input.currentPassword,
    user.passwordHash
  )
  if (!currentOk) {
    throw new InvalidCredentialsError("Your current password is incorrect.")
  }

  if (await verifyPassword(input.newPassword, user.passwordHash)) {
    throw new ValidationError(
      "Your new password must be different from the current one."
    )
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.newPassword) },
  })

  await revokeAllSessions(userId)

  void sendPasswordChangedEmail(user).catch((error: unknown) => {
    logger.error({ err: error }, "Password-changed email failed")
  })
}
