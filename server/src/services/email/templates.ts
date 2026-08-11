/**
 * Email templates.
 *
 * Plain functions returning HTML + text. SwiftEdge inlined its templates in
 * route handlers, hardcoded the from-address in five places, and shipped a
 * malformed `</strong>` in the profit email.
 */

const BRAND = "Sterling Edge Trade"
const PRIMARY = "#2563eb"
const INK = "#0f172a"
const MUTED = "#64748b"
const BORDER = "#e2e8f0"

export interface Email {
  subject: string
  html: string
  text: string
}

function layout(heading: string, body: string): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${BORDER};border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:24px 32px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">${BRAND}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:${INK};">${heading}</h1>
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid ${BORDER};">
            <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};">
              Trading carries a high level of risk and you may lose some or all of your invested capital.
              Past performance is not a reliable indicator of future results.
            </p>
            <p style="margin:10px 0 0;font-size:12px;color:${MUTED};">
              &copy; ${new Date().getFullYear()} ${BRAND}. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function paragraph(content: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#334155;">${content}</p>`
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td style="border-radius:10px;background:${PRIMARY};">
      <a href="${href}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${label}</a>
    </td></tr>
  </table>`
}

function panel(rows: Array<[string, string]>): string {
  const cells = rows
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:7px 0;font-size:14px;color:${MUTED};">${label}</td>
          <td style="padding:7px 0;font-size:14px;font-weight:600;color:${INK};text-align:right;">${value}</td>
        </tr>`
    )
    .join("")

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;padding:16px 18px;background:#f8fafc;border:1px solid ${BORDER};border-radius:12px;">${cells}</table>`
}

const money = (value: string) => `$${value}`

export function welcomeEmail(params: {
  fullName: string
  username: string
  uid: string
  appUrl: string
}): Email {
  const first = params.fullName.split(" ")[0] ?? params.fullName

  return {
    subject: `Welcome to ${BRAND}`,
    html: layout(
      `Welcome aboard, ${first}`,
      paragraph(
        "Your account is ready. You can now fund it and start trading across forex, crypto, stocks and commodities from a single balance."
      ) +
        panel([
          ["Username", params.username],
          ["Account reference", params.uid],
        ]) +
        button(`${params.appUrl}/login`, "Sign in to your account") +
        paragraph(
          `Keep your account reference handy — our support team will ask for it.`
        )
    ),
    text: `Welcome aboard, ${first}.

Your ${BRAND} account is ready.

Username: ${params.username}
Account reference: ${params.uid}

Sign in: ${params.appUrl}/login`,
  }
}

export function passwordResetEmail(params: {
  fullName: string
  resetUrl: string
  ttlMinutes: number
}): Email {
  const first = params.fullName.split(" ")[0] ?? params.fullName

  return {
    subject: "Reset your password",
    html: layout(
      "Reset your password",
      paragraph(`Hi ${first}, we received a request to reset your password.`) +
        button(params.resetUrl, "Choose a new password") +
        paragraph(
          `This link expires in ${params.ttlMinutes} minutes and can only be used once.`
        ) +
        paragraph(
          "If you didn't request this, you can ignore this email — your password will not change."
        )
    ),
    text: `Hi ${first},

Reset your ${BRAND} password using the link below. It expires in ${params.ttlMinutes} minutes and can only be used once.

${params.resetUrl}

If you didn't request this, ignore this email.`,
  }
}

export function passwordChangedEmail(params: {
  fullName: string
  supportEmail: string
}): Email {
  const first = params.fullName.split(" ")[0] ?? params.fullName

  return {
    subject: "Your password was changed",
    html: layout(
      "Your password was changed",
      paragraph(
        `Hi ${first}, the password on your ${BRAND} account was just changed and all devices have been signed out.`
      ) +
        paragraph(
          `If this wasn't you, contact us immediately at <a href="mailto:${params.supportEmail}" style="color:${PRIMARY};">${params.supportEmail}</a>.`
        )
    ),
    text: `Hi ${first},

The password on your ${BRAND} account was just changed and all devices were signed out.

If this wasn't you, contact ${params.supportEmail} immediately.`,
  }
}

export function depositApprovedEmail(params: {
  fullName: string
  amount: string
  newBalance: string
}): Email {
  return {
    subject: "Your deposit has been credited",
    html: layout(
      "Deposit confirmed",
      paragraph(
        `Hi ${params.fullName.split(" ")[0]}, your deposit has been verified and credited to your account.`
      ) +
        panel([
          ["Amount credited", money(params.amount)],
          ["New balance", money(params.newBalance)],
        ])
    ),
    text: `Your deposit of ${money(params.amount)} has been credited. New balance: ${money(params.newBalance)}.`,
  }
}

export function depositRejectedEmail(params: {
  fullName: string
  amount: string
  reason: string | null
}): Email {
  return {
    subject: "We couldn't verify your deposit",
    html: layout(
      "Deposit not verified",
      paragraph(
        `Hi ${params.fullName.split(" ")[0]}, we were unable to verify your deposit of ${money(params.amount)}.`
      ) +
        (params.reason ? panel([["Reason", params.reason]]) : "") +
        paragraph(
          "No funds have been credited. Please check the payment details and submit again, or contact support."
        )
    ),
    text: `We couldn't verify your deposit of ${money(params.amount)}.${params.reason ? ` Reason: ${params.reason}.` : ""} No funds were credited.`,
  }
}

export function withdrawalSubmittedEmail(params: {
  fullName: string
  amount: string
  fee: string
  method: string
}): Email {
  return {
    subject: "Withdrawal request received",
    html: layout(
      "Withdrawal request received",
      paragraph(
        `Hi ${params.fullName.split(" ")[0]}, we've received your withdrawal request and it's now awaiting review.`
      ) +
        panel([
          ["Amount", money(params.amount)],
          ["Fee", money(params.fee)],
          ["Method", params.method],
        ]) +
        paragraph(
          "These funds are on hold and are no longer available to trade while the request is reviewed."
        )
    ),
    text: `Withdrawal request received: ${money(params.amount)} (fee ${money(params.fee)}) via ${params.method}. These funds are on hold pending review.`,
  }
}

export function withdrawalApprovedEmail(params: {
  fullName: string
  amount: string
  method: string
  newBalance: string
}): Email {
  return {
    subject: "Your withdrawal has been approved",
    html: layout(
      "Withdrawal approved",
      paragraph(
        `Hi ${params.fullName.split(" ")[0]}, your withdrawal has been approved and is on its way.`
      ) +
        panel([
          ["Amount", money(params.amount)],
          ["Method", params.method],
          ["Remaining balance", money(params.newBalance)],
        ])
    ),
    text: `Your withdrawal of ${money(params.amount)} via ${params.method} has been approved. Remaining balance: ${money(params.newBalance)}.`,
  }
}

export function withdrawalRejectedEmail(params: {
  fullName: string
  amount: string
  reason: string | null
}): Email {
  return {
    subject: "Your withdrawal was declined",
    html: layout(
      "Withdrawal declined",
      paragraph(
        `Hi ${params.fullName.split(" ")[0]}, your withdrawal request for ${money(params.amount)} was declined.`
      ) +
        (params.reason ? panel([["Reason", params.reason]]) : "") +
        paragraph("The funds have been released back into your balance.")
    ),
    text: `Your withdrawal of ${money(params.amount)} was declined.${params.reason ? ` Reason: ${params.reason}.` : ""} The funds have been released back into your balance.`,
  }
}

export function accountCreditedEmail(params: {
  fullName: string
  amount: string
  description: string | null
  newBalance: string
}): Email {
  return {
    subject: "Your account has been credited",
    html: layout(
      "Account credited",
      paragraph(`Hi ${params.fullName.split(" ")[0]}, funds have been added to your account.`) +
        panel([
          ["Amount", money(params.amount)],
          ...(params.description
            ? ([["Details", params.description]] as Array<[string, string]>)
            : []),
          ["New balance", money(params.newBalance)],
        ])
    ),
    text: `Your account was credited ${money(params.amount)}.${params.description ? ` ${params.description}.` : ""} New balance: ${money(params.newBalance)}.`,
  }
}

export function withdrawalPinEmail(params: {
  fullName: string
  expiresInMinutes: number
}): Email {
  return {
    subject: "Your withdrawal PIN is ready",
    html: layout(
      "Your withdrawal PIN is ready",
      paragraph(
        `Hi ${params.fullName.split(" ")[0]}, a withdrawal PIN has been issued for your account. Your account manager will provide it to you directly.`
      ) +
        paragraph(
          `The PIN expires in ${params.expiresInMinutes} minutes and can only be used once.`
        ) +
        paragraph(
          "We will never ask for your PIN by email or message. Only enter it on the withdrawal page."
        )
    ),
    text: `A withdrawal PIN has been issued for your account. It expires in ${params.expiresInMinutes} minutes and can be used once. We will never ask you for it by email.`,
  }
}
