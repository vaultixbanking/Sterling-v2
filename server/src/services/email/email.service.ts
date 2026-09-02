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

export function sendLoginAlertEmail(
  user: User,
  context: { ipAddress: string | null; device: string | null }
): Promise<void> {
  return send(
    user.email,
    templates.loginAlertEmail({
      fullName: user.fullName,
      when: new Date(),
      ipAddress: context.ipAddress,
      device: context.device,
      supportEmail: env.SUPPORT_EMAIL,
    })
  )
}

export function sendAccountSuspendedEmail(
  user: User,
  reason: string | null
): Promise<void> {
  return send(
    user.email,
    templates.accountSuspendedEmail({
      fullName: user.fullName,
      reason,
      supportEmail: env.SUPPORT_EMAIL,
    })
  )
}

export function sendAccountReactivatedEmail(user: User): Promise<void> {
  return send(
    user.email,
    templates.accountReactivatedEmail({
      fullName: user.fullName,
      appUrl: env.APP_URL,
    })
  )
}

export function sendDepositSubmittedEmail(
  user: User,
  amount: string,
  method: string,
  reference: string | null
): Promise<void> {
  return send(
    user.email,
    templates.depositSubmittedEmail({
      fullName: user.fullName,
      amount,
      method,
      reference,
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

export function sendWithdrawalCancelledEmail(
  user: User,
  amount: string,
  newBalance: string
): Promise<void> {
  return send(
    user.email,
    templates.withdrawalCancelledEmail({
      fullName: user.fullName,
      amount,
      newBalance,
    })
  )
}

export function sendSubscriptionConfirmedEmail(
  user: User,
  subscription: {
    planName: string
    principal: string
    dailyReturnPercent: string
    durationDays: number
    endsAt: Date
    newBalance: string
  }
): Promise<void> {
  return send(
    user.email,
    templates.subscriptionConfirmedEmail({
      fullName: user.fullName,
      ...subscription,
    })
  )
}

export function sendSubscriptionCompletedEmail(
  user: User,
  subscription: {
    planName: string
    principal: string
    totalEarned: string
    newBalance: string
  }
): Promise<void> {
  return send(
    user.email,
    templates.subscriptionCompletedEmail({
      fullName: user.fullName,
      ...subscription,
    })
  )
}

export function sendSubscriptionCancelledEmail(
  user: User,
  subscription: { planName: string; principal: string; newBalance: string }
): Promise<void> {
  return send(
    user.email,
    templates.subscriptionCancelledEmail({
      fullName: user.fullName,
      ...subscription,
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

export function sendAccountDebitedEmail(
  user: User,
  amount: string,
  description: string | null,
  newBalance: string
): Promise<void> {
  return send(
    user.email,
    templates.accountDebitedEmail({
      fullName: user.fullName,
      amount,
      description,
      newBalance,
      supportEmail: env.SUPPORT_EMAIL,
    })
  )
}

export function sendProfitCreditedEmail(
  user: User,
  amount: string,
  description: string | null,
  newBalance: string
): Promise<void> {
  return send(
    user.email,
    templates.profitCreditedEmail({
      fullName: user.fullName,
      amount,
      description,
      newBalance,
    })
  )
}

export function sendHoldingAddedEmail(
  user: User,
  holding: {
    name: string
    symbol: string
    units: string
    valueUsd: string
    newBalance: string
  }
): Promise<void> {
  return send(
    user.email,
    templates.holdingAddedEmail({ fullName: user.fullName, ...holding })
  )
}

/**
 * The PIN travels in the email body, so this is the one send that must never be
 * logged or retried into a different address. `send` already logs subject and
 * recipient only, never the rendered body — keep it that way.
 */
export function sendWithdrawalPinEmail(
  user: User,
  pin: string,
  expiresInMinutes: number
): Promise<void> {
  return send(
    user.email,
    templates.withdrawalPinEmail({
      fullName: user.fullName,
      pin,
      expiresInMinutes,
    })
  )
}

export function sendWithdrawalPinRevokedEmail(user: User): Promise<void> {
  return send(
    user.email,
    templates.withdrawalPinRevokedEmail({ fullName: user.fullName })
  )
}

export function sendEmailVerificationEmail(
  user: User,
  token: string,
  ttlMinutes: number
): Promise<void> {
  const verifyUrl = `${env.APP_URL}/verify-email?token=${encodeURIComponent(token)}`

  return send(
    user.email,
    templates.emailVerificationEmail({
      fullName: user.fullName,
      verifyUrl,
      ttlMinutes,
    })
  )
}
