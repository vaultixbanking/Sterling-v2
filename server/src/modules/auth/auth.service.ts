import { UserStatus, type User } from "@prisma/client"

import { RESET_TOKEN_TTL_MINUTES } from "../../config/constants.js"
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
import { sendPasswordChangedEmail } from "../../services/email/email.service.js"
import { sendPasswordResetEmail } from "../../services/email/email.service.js"
import { sendWelcomeEmail } from "../../services/email/email.service.js"
import { revokeAllSessions } from "./token.service.js"
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
  phone: string | null
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
  const [emailTaken, usernameTaken] = await Promise.all([
    prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { username: input.username },
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
      phone: input.phone?.trim() ? input.phone.trim() : null,
      passwordHash: await hashPassword(input.password),
    },
  })

  // Fire-and-forget: a mail outage must not fail registration.
  void sendWelcomeEmail(user).catch((error: unknown) => {
    logger.error({ err: error, userId: user.id }, "Welcome email failed")
  })

  return toPublicUser(user)
}

export async function login(
  input: LoginInput
): Promise<User> {
  const identifier = input.identifier.toLowerCase()

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { username: input.identifier }],
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
