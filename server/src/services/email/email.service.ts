import type { User } from "@prisma/client"
import { Resend } from "resend"

import { RESET_TOKEN_TTL_MINUTES } from "../../config/constants.js"
import { env, features, isProduction } from "../../config/env.js"
import { logger } from "../../lib/logger.js"
import * as templates from "./templates.js"
import type { Email } from "./templates.js"

/**
 * Resend wrapper.
 *
 * The from-address comes from config rather than being hardcoded in five
 * places, and there is deliberately no generic "send arbitrary email" route —
 * SwiftEdge shipped `POST /debug-email` unauthenticated, which is an open mail
 * relay on a verified sending domain.
 */

const resend = features.email ? new Resend(env.RESEND_API_KEY) : null

async function send(to: string, email: Email): Promise<void> {
  if (!resend) {
    logger.debug(
      { to, subject: email.subject },
      "Email skipped — RESEND_API_KEY not configured"
    )
    return
  }

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  })

  if (error) {
    // Surfaced to the caller, which decides whether it is fatal. SwiftEdge's
    // helpers swallowed failures and always reported success.
    throw new Error(`Resend rejected the message: ${error.message}`)
  }

  logger.info({ to, subject: email.subject }, "Email sent")
}

export function sendWelcomeEmail(user: User): Promise<void> {
  return send(
    user.email,
    templates.welcomeEmail({
      fullName: user.fullName,
      username: user.username,
      uid: user.uid,
      appUrl: env.APP_URL,
    })
  )
}

export function sendPasswordResetEmail(
  user: User,
  token: string
): Promise<void> {
  // Built from config — SwiftEdge hardcoded the production domain, so reset
  // links were broken in local development and staging.
  const resetUrl = `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`

  // Reset tokens are stored SHA-256 hashed, so without a mail provider there is
  // no way to recover one — which makes the whole flow untestable locally.
  // Printing it is safe here and only here: development, and only when mail is
  // switched off. Production requires RESEND_API_KEY, so this cannot fire there.
  if (!features.email && !isProduction) {
    logger.warn({ resetUrl }, "Mail is disabled — password reset link below")
  }

  return send(
    user.email,
    templates.passwordResetEmail({
      fullName: user.fullName,
      resetUrl,
      ttlMinutes: RESET_TOKEN_TTL_MINUTES,
    })
  )
}

export function sendPasswordChangedEmail(user: User): Promise<void> {
  return send(
    user.email,
    templates.passwordChangedEmail({
      fullName: user.fullName,
      supportEmail: env.SUPPORT_EMAIL,
    })
  )
}

export function sendDepositApprovedEmail(
  user: User,
  amount: string,
  newBalance: string
): Promise<void> {
  return send(
    user.email,
    templates.depositApprovedEmail({
      fullName: user.fullName,
      amount,
      newBalance,
    })
  )
}

export function sendDepositRejectedEmail(
  user: User,
  amount: string,
  reason: string | null
): Promise<void> {
  return send(
    user.email,
    templates.depositRejectedEmail({
      fullName: user.fullName,
      amount,
      reason,
    })
  )
}

export function sendWithdrawalSubmittedEmail(
  user: User,
  amount: string,
  fee: string,
  method: string
): Promise<void> {
  return send(
    user.email,
    templates.withdrawalSubmittedEmail({
      fullName: user.fullName,
      amount,
      fee,
      method,
    })
  )
}

export function sendWithdrawalApprovedEmail(
  user: User,
  amount: string,
  method: string,
  newBalance: string
): Promise<void> {
  return send(
    user.email,
    templates.withdrawalApprovedEmail({
      fullName: user.fullName,
      amount,
      method,
      newBalance,
    })
  )
}

export function sendWithdrawalRejectedEmail(
  user: User,
  amount: string,
  reason: string | null
): Promise<void> {
  return send(
    user.email,
    templates.withdrawalRejectedEmail({
      fullName: user.fullName,
      amount,
      reason,
    })
  )
}

export function sendAccountCreditedEmail(
  user: User,
  amount: string,
  description: string | null,
  newBalance: string
): Promise<void> {
  return send(
    user.email,
    templates.accountCreditedEmail({
      fullName: user.fullName,
      amount,
      description,
      newBalance,
    })
  )
}

export function sendWithdrawalPinEmail(
  user: User,
  expiresInMinutes: number
): Promise<void> {
  return send(
    user.email,
    templates.withdrawalPinEmail({
      fullName: user.fullName,
      expiresInMinutes,
    })
  )
}
