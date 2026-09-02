/**
 * Email templates.
 *
 * Plain functions returning HTML + text. SwiftEdge inlined its templates in
 * route handlers, hardcoded the from-address in five places, and shipped a
 * malformed `</strong>` in the profit email.
 *
 * Two rules hold everything together:
 *
 * 1. **Every value that came from a user or an admin is escaped.** `fullName`
 *    is chosen at signup and `reason` / `description` are admin free text, so
 *    without escaping someone could sign up as `<a href="…">Verify now</a>`
 *    and have that render inside a genuine, correctly-signed platform email.
 *    `panel()` escapes its own arguments so a new template cannot forget;
 *    `paragraph()` deliberately does not, because prose carries links, so
 *    interpolations there go through `esc()` at the call site.
 * 2. **Money never touches a float.** Amounts arrive as decimal strings from
 *    `serialize()` and are grouped as strings, mirroring the frontend.
 */

const BRAND = "Sterling Edge Trade"

const PRIMARY = "#2563eb"
const INK = "#0f172a"
const BODY_TEXT = "#334155"
const MUTED = "#64748b"
const FAINT = "#94a3b8"
const BORDER = "#e2e8f0"
const CANVAS = "#eef2f7"
const SUBTLE = "#f8fafc"

/**
 * Absolute URL for the logo. Email clients will not load a relative path, and
 * SVG is stripped by Gmail, Outlook and Yahoo — so this must be a hosted PNG.
 * `public/logo-mark-144.png` is rendered from `public/logo-mark.svg` and served
 * by the Next.js app; `EMAIL_ASSET_BASE_URL` overrides the host if the assets
 * ever move to a CDN or a storage bucket.
 *
 * Read from `process.env` rather than `config/env.ts` so this module stays a
 * leaf with no imports — it is rendered by tooling and tests that never boot
 * the server.
 */
const ASSET_BASE = (
  process.env.EMAIL_ASSET_BASE_URL ??
  process.env.APP_URL ??
  "https://sterlingedgetrade.com"
).replace(/\/+$/, "")

const LOGO_URL = `${ASSET_BASE}/logo-mark-144.png`

/**
 * Accent colour per message type. The header rule, the eyebrow and any status
 * chip all read from one tone, so an approval never arrives looking like a
 * rejection because two places were changed independently.
 */
type Tone = "brand" | "success" | "warn" | "danger" | "neutral"

const TONES: Record<Tone, { accent: string; soft: string; softBorder: string; deep: string }> = {
  brand: { accent: PRIMARY, soft: "#eff6ff", softBorder: "#bfdbfe", deep: "#1e40af" },
  success: { accent: "#059669", soft: "#ecfdf5", softBorder: "#a7f3d0", deep: "#065f46" },
  warn: { accent: "#d97706", soft: "#fffbeb", softBorder: "#fde68a", deep: "#92400e" },
  danger: { accent: "#dc2626", soft: "#fef2f2", softBorder: "#fecaca", deep: "#991b1b" },
  neutral: { accent: "#475569", soft: SUBTLE, softBorder: BORDER, deep: "#334155" },
}

export interface Email {
  subject: string
  html: string
  text: string
}

/** HTML-escape a value for use in either element text or a quoted attribute. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** The name we greet someone by. Raw — escape it before putting it in HTML. */
function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName
}

/**
 * Group a decimal string for display: "13842.5" -> "13,842.50".
 *
 * String-only, because `parseFloat` on a money value is how you end up
 * emailing someone "$13,842.549999999999".
 */
function formatAmount(value: string): string {
  const trimmed = value.trim()
  const negative = trimmed.startsWith("-")
  const [whole = "0", fraction = ""] = (negative ? trimmed.slice(1) : trimmed).split(".")
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")

  return `${negative ? "-" : ""}${grouped}.${`${fraction}00`.slice(0, 2)}`
}

const money = (value: string) => `$${formatAmount(value)}`

/**
 * Trims the trailing zeros Postgres pads onto a `numeric(24,8)`.
 *
 * `0.00500000 BTC` reads like a rounding artefact; `0.005 BTC` reads like a
 * position. Whole numbers keep their form — "100" has no fraction to trim.
 */
function formatUnits(value: string): string {
  const trimmed = value.trim()
  return trimmed.includes(".") ? trimmed.replace(/\.?0+$/, "") : trimmed
}

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
})

const formatDate = (date: Date) => dateFormat.format(date)
const formatDateTime = (date: Date) => `${dateTimeFormat.format(date)} UTC`

/**
 * @param preheader The line inboxes show next to the subject. Without one they
 *   scrape the first visible text, which here would be the brand name on every
 *   single email.
 */
interface LayoutOptions {
  /** Small uppercase label above the heading — orients the reader instantly. */
  eyebrow?: string
  tone?: Tone
}

/**
 * @param heading Raw HTML, same contract as `paragraph()` — several call sites
 *   interpolate `esc(first)` or `esc(planName)` themselves, so escaping here
 *   too would render "O'Brien" as "O&#39;Brien". `eyebrow` is escaped because
 *   it is always a literal chosen in this file.
 */
function layout(
  heading: string,
  body: string,
  preheader: string,
  options: LayoutOptions = {}
): string {
  const tone = TONES[options.tone ?? "brand"]

  const eyebrow = options.eyebrow
    ? `<p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${tone.accent};">${esc(options.eyebrow)}</p>`
    : ""

  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>${heading}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    /* Only progressive enhancement lives here — every critical style is inline,
       because Gmail strips <style> on forwarded mail. */
    @media only screen and (max-width:620px) {
      .sp { padding-left:22px !important; padding-right:22px !important; }
      .hero-amount { font-size:30px !important; }
      h1 { font-size:21px !important; }
    }
    a[x-apple-data-detectors] { color:inherit !important; text-decoration:none !important; }
  </style>
</head>
<body style="margin:0;padding:0;width:100%;background:${CANVAS};-webkit-font-smoothing:antialiased;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader}</div>
  <!-- Zero-width joiners stop clients padding the preview with body text. -->
  <div style="display:none;max-height:0;overflow:hidden;">&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CANVAS};">
    <tr><td align="center" style="padding:36px 16px;">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

        <!-- Brand bar -->
        <tr>
          <td bgcolor="${INK}" style="background:${INK};border-radius:16px 16px 0 0;padding:22px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="40" style="padding-right:12px;">
                  <img src="${LOGO_URL}" width="40" height="40" alt="${esc(BRAND)}"
                       style="display:block;width:40px;height:40px;border:0;border-radius:10px;">
                </td>
                <td style="vertical-align:middle;">
                  <span style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:-0.3px;">${BRAND}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Tone rule: a 3px accent that tells you the kind of message at a glance -->
        <tr>
          <td bgcolor="${tone.accent}" style="background:${tone.accent};font-size:0;line-height:0;height:3px;">&nbsp;</td>
        </tr>

        <!-- Content -->
        <tr>
          <td bgcolor="#ffffff" class="sp" style="background:#ffffff;padding:34px 32px 30px;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};">
            ${eyebrow}
            <h1 style="margin:0 0 18px;font-size:24px;line-height:1.28;font-weight:700;letter-spacing:-0.4px;color:${INK};">${heading}</h1>
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td bgcolor="${SUBTLE}" class="sp" style="background:${SUBTLE};padding:22px 32px 26px;border:1px solid ${BORDER};border-top:0;border-radius:0 0 16px 16px;">
            <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:${MUTED};">
              Sent by <strong style="color:${BODY_TEXT};">${BRAND}</strong>. This is an automated message — replies are not monitored.
            </p>
            <p style="margin:0 0 12px;font-size:11.5px;line-height:1.65;color:${FAINT};">
              Trading carries a high level of risk and you may lose some or all of your invested capital.
              Past performance is not a reliable indicator of future results.
            </p>
            <p style="margin:0;font-size:11.5px;color:${FAINT};">
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

/** Prose. Carries markup, so escape interpolations with `esc()` yourself. */
function paragraph(content: string): string {
  return `<p style="margin:0 0 15px;font-size:15.5px;line-height:1.68;color:${BODY_TEXT};">${content}</p>`
}

/** Opening line of an email that needs a warmer, more spacious voice. */
function lead(content: string): string {
  return `<p style="margin:0 0 20px;font-size:17px;line-height:1.62;color:${BODY_TEXT};">${content}</p>`
}

/**
 * Numbered "what happens next" list. Rounded squares rather than circles: a
 * circle relies on border-radius, which Outlook drops, and a squashed oval
 * looks broken in a way a rounded square does not.
 */
function steps(items: Array<[string, string]>, tone: Tone = "brand"): string {
  const { accent, soft } = TONES[tone]

  const rows = items
    .map(
      ([title, detail], index) =>
        `<tr>
          <td width="34" valign="top" style="padding:0 14px ${index === items.length - 1 ? "0" : "18px"} 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="34">
              <tr><td align="center" bgcolor="${soft}" height="34" style="background:${soft};width:34px;height:34px;border-radius:10px;font-size:15px;font-weight:700;color:${accent};line-height:34px;">${index + 1}</td></tr>
            </table>
          </td>
          <td valign="top" style="padding:0 0 ${index === items.length - 1 ? "0" : "18px"};">
            <p style="margin:0 0 3px;font-size:15px;font-weight:700;color:${INK};line-height:1.4;">${esc(title)}</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:${MUTED};">${esc(detail)}</p>
          </td>
        </tr>`
    )
    .join("")

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 24px;">${rows}</table>`
}

/** A row of small pills — used to show what can be traded at a glance. */
function chips(labels: string[]): string {
  const cells = labels
    .map(
      (label) =>
        `<td style="padding:0 7px 7px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td bgcolor="${SUBTLE}" style="background:${SUBTLE};border:1px solid ${BORDER};border-radius:999px;padding:6px 13px;font-size:12.5px;font-weight:600;color:${BODY_TEXT};white-space:nowrap;">${esc(label)}</td></tr>
          </table>
        </td>`
    )
    .join("")

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr>${cells}</tr></table>`
}

/** Section label inside the body, for emails long enough to need signposting. */
function sectionTitle(text: string): string {
  return `<p style="margin:26px 0 14px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${MUTED};">${esc(text)}</p>`
}

/**
 * Call-to-action. The VML block is what makes it clickable across its whole
 * area in Outlook 2007–2019, which ignores padding on an anchor and would
 * otherwise render a bare line of text.
 */
function button(href: string, label: string, tone: Tone = "brand"): string {
  const { accent } = TONES[tone]
  const safeHref = esc(href)

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0;">
    <tr><td align="center" bgcolor="${accent}" style="border-radius:10px;background:${accent};">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
        href="${safeHref}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="21%" stroke="f" fillcolor="${accent}">
        <w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${esc(label)}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a href="${safeHref}" target="_blank" rel="noopener"
         style="display:inline-block;padding:15px 32px;font-size:15px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:-0.1px;">${esc(label)}</a>
      <!--<![endif]-->
    </td></tr>
  </table>`
}

/**
 * The headline number on a money email. A balance buried in a data row gets
 * skimmed past; this is the one thing the reader actually opened for.
 */
function amountHero(amount: string, caption: string, tone: Tone = "brand"): string {
  const { accent, soft, softBorder } = TONES[tone]

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px;background:${soft};border:1px solid ${softBorder};border-radius:14px;">
    <tr><td align="center" style="padding:24px 20px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.11em;text-transform:uppercase;color:${accent};">${esc(caption)}</p>
      <p class="hero-amount" style="margin:0;font-size:36px;line-height:1.1;font-weight:700;letter-spacing:-1px;color:${INK};">${esc(amount)}</p>
    </td></tr>
  </table>`
}

/**
 * A one-time code, sized to be read off a phone and typed into another screen.
 *
 * Wide letter-spacing and a monospace face because the reader is transcribing
 * character by character, and 0/O and 1/l are the pairs that get mistyped.
 */
/**
 * "90 minutes" is how a config value reads; "an hour and a half" is how a
 * person reads it. The PIN window is quoted to someone under mild time
 * pressure, so it is spelled the way they would say it out loud.
 */
function describeMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`

  const hours = minutes / 60
  if (Number.isInteger(hours)) {
    return `${hours} hour${hours === 1 ? "" : "s"}`
  }

  const whole = Math.floor(hours)
  const rest = minutes - whole * 60
  return `${whole} hour${whole === 1 ? "" : "s"} ${rest} minutes`
}

function codeHero(code: string, caption: string): string {
  const { accent, soft, softBorder } = TONES.warn

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px;background:${soft};border:1px solid ${softBorder};border-radius:14px;">
    <tr><td align="center" style="padding:24px 20px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.11em;text-transform:uppercase;color:${accent};">${esc(caption)}</p>
      <p style="margin:0;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:34px;line-height:1.1;font-weight:700;letter-spacing:10px;text-indent:10px;color:${INK};">${esc(code)}</p>
    </td></tr>
  </table>`
}

/**
 * Data rows. Escapes both columns — pass plain text, never markup.
 *
 * @param title Optional header strip, so a panel reads as a labelled block
 *   rather than a floating table of values.
 */
function panel(rows: Array<[string, string]>, title?: string): string {
  const head = title
    ? `<tr><td colspan="2" style="padding:11px 18px;background:${SUBTLE};border-bottom:1px solid ${BORDER};font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${MUTED};">${esc(title)}</td></tr>`
    : ""

  const cells = rows
    .map(
      ([label, value], index) =>
        `<tr>
          <td style="padding:12px 18px;font-size:14px;color:${MUTED};${index > 0 ? `border-top:1px solid ${BORDER};` : ""}">${esc(label)}</td>
          <td style="padding:12px 18px;font-size:14px;font-weight:600;color:${INK};text-align:right;${index > 0 ? `border-top:1px solid ${BORDER};` : ""}">${esc(value)}</td>
        </tr>`
    )
    .join("")

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;background:#ffffff;border:1px solid ${BORDER};border-radius:12px;">${head}${cells}</table>`
}

/**
 * A tinted notice. Used for the "if this wasn't you" line on security emails,
 * which has to survive being skim-read.
 */
function callout(content: string, tone: "warn" | "info" = "info"): string {
  const palette = tone === "warn" ? TONES.danger : TONES.brand

  // The 4px left bar survives clients that drop border-radius, so the notice
  // still reads as set apart rather than as an oddly tinted paragraph.
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;background:${palette.soft};border:1px solid ${palette.softBorder};border-radius:12px;">
    <tr>
      <td width="4" bgcolor="${palette.accent}" style="background:${palette.accent};font-size:0;line-height:0;border-radius:12px 0 0 12px;">&nbsp;</td>
      <td style="padding:15px 18px;font-size:14.5px;line-height:1.62;color:${palette.deep};">${content}</td>
    </tr>
  </table>`
}

/**
 * A mailto link. `color` defaults to the brand blue, but links sitting inside a
 * `warn` callout pass its red so the two do not clash.
 */
function mailLink(address: string, color: string = PRIMARY): string {
  return `<a href="mailto:${esc(address)}" style="color:${color};font-weight:600;">${esc(address)}</a>`
}

/** Only rendered when a reason was actually given. */
const reasonPanel = (reason: string | null) =>
  reason?.trim() ? panel([["Reason", reason.trim()]]) : ""

const reasonText = (reason: string | null) =>
  reason?.trim() ? ` Reason: ${reason.trim()}.` : ""

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

export function welcomeEmail(params: {
  fullName: string
  username: string
  uid: string
  appUrl: string
}): Email {
  const first = firstNameOf(params.fullName)

  return {
    subject: `Welcome to ${BRAND}, ${first}`,
    html: layout(
      `Welcome aboard, ${esc(first)}`,
      lead(
        `Your account is open and ready to fund. Everything you trade lives in one balance — no juggling separate wallets, and every deposit, payout and position tracked in a single dashboard.`
      ) +
        chips(["Forex", "Crypto", "Stocks", "Commodities"]) +
        panel(
          [
            ["Username", params.username],
            ["Account reference", params.uid],
          ],
          "Your sign-in details"
        ) +
        sectionTitle("Getting started") +
        steps([
          [
            "Fund your account",
            "Deposit by bank transfer, crypto or digital wallet. Our team verifies each payment and credits your balance — you'll get an email either way.",
          ],
          [
            "Choose an investment plan",
            "Four plans, each with a fixed daily return and term. Commit what suits you and the returns accrue automatically.",
          ],
          [
            "Withdraw whenever you're ready",
            "Request a withdrawal to your bank or wallet. Your funds are held the moment you ask, so the balance you see is always the balance you can spend.",
          ],
        ]) +
        button(`${params.appUrl}/login`, "Sign in to your account") +
        paragraph(
          `Keep your account reference <strong style="color:${INK};">${esc(params.uid)}</strong> somewhere handy — our support team will ask for it before discussing your account.`
        ) +
        callout(
          `We'll never email you asking for your password or a withdrawal PIN. If a message asks for either, it isn't from us.`
        ),
      `Your account is open, ${first} — here's how to get started.`,
      { eyebrow: "Welcome", tone: "brand" }
    ),
    text: `Welcome aboard, ${first}.

Your ${BRAND} account is open and ready to fund. Everything you trade — forex, crypto, stocks and commodities — lives in one balance.

YOUR SIGN-IN DETAILS
Username: ${params.username}
Account reference: ${params.uid}

GETTING STARTED
1. Fund your account. Deposit by bank transfer, crypto or digital wallet. Our team verifies each payment and credits your balance.
2. Choose an investment plan. Four plans, each with a fixed daily return and term.
3. Withdraw whenever you're ready. Funds are held the moment you request, so the balance you see is the balance you can spend.

Sign in: ${params.appUrl}/login

Keep your account reference ${params.uid} handy — support will ask for it.

We will never email you asking for your password or a withdrawal PIN.`,
  }
}

export function emailVerificationEmail(params: {
  fullName: string
  verifyUrl: string
  ttlMinutes: number
}): Email {
  const first = firstNameOf(params.fullName)

  return {
    subject: "Confirm your email address",
    html: layout(
      "Confirm your email address",
      paragraph(
        `Hi ${esc(first)}, please confirm this address so we can send you deposit, withdrawal and security notices.`
      ) +
        button(params.verifyUrl, "Confirm my email") +
        paragraph(
          `This link expires in ${params.ttlMinutes} minutes and can only be used once.`
        ) +
        paragraph(
          `If you didn't create a ${BRAND} account, you can safely ignore this email.`
        ),
      "One click to confirm your address and secure your account.",
      { eyebrow: "Verify your email", tone: "brand" }
    ),
    text: `Hi ${first},

Confirm your email address for ${BRAND}. This link expires in ${params.ttlMinutes} minutes and can only be used once.

${params.verifyUrl}

If you didn't create an account, ignore this email.`,
  }
}

export function passwordResetEmail(params: {
  fullName: string
  resetUrl: string
  ttlMinutes: number
}): Email {
  const first = firstNameOf(params.fullName)

  return {
    subject: "Reset your password",
    html: layout(
      "Reset your password",
      paragraph(
        `Hi ${esc(first)}, we received a request to reset your password.`
      ) +
        button(params.resetUrl, "Choose a new password") +
        paragraph(
          `This link expires in ${params.ttlMinutes} minutes and can only be used once.`
        ) +
        callout(
          "If you didn't request this, you can ignore this email — your password will not change, and nobody can reset it without this link."
        ),
      `Reset link inside — valid for ${params.ttlMinutes} minutes.`,
      { eyebrow: "Security", tone: "warn" }
    ),
    text: `Hi ${first},

Reset your ${BRAND} password using the link below. It expires in ${params.ttlMinutes} minutes and can only be used once.

${params.resetUrl}

If you didn't request this, ignore this email — your password will not change.`,
  }
}

export function passwordChangedEmail(params: {
  fullName: string
  supportEmail: string
}): Email {
  const first = firstNameOf(params.fullName)
  const mailto = mailLink(params.supportEmail, "#991b1b")

  return {
    subject: "Your password was changed",
    html: layout(
      "Your password was changed",
      paragraph(
        `Hi ${esc(first)}, the password on your ${BRAND} account was just changed and every device has been signed out.`
      ) +
        callout(
          `If this wasn't you, contact us immediately at ${mailto}. Your account may be at risk.`,
          "warn"
        ),
      "Your password was just changed and all devices were signed out.",
      { eyebrow: "Security", tone: "success" }
    ),
    text: `Hi ${first},

The password on your ${BRAND} account was just changed and every device was signed out.

If this wasn't you, contact ${params.supportEmail} immediately.`,
  }
}

export function loginAlertEmail(params: {
  fullName: string
  when: Date
  ipAddress: string | null
  device: string | null
  supportEmail: string
}): Email {
  const first = firstNameOf(params.fullName)
  const mailto = mailLink(params.supportEmail, "#991b1b")

  const rows: Array<[string, string]> = [["When", formatDateTime(params.when)]]
  if (params.device) rows.push(["Device", params.device])
  if (params.ipAddress) rows.push(["IP address", params.ipAddress])

  return {
    subject: "New sign-in to your account",
    html: layout(
      "New sign-in to your account",
      paragraph(
        `Hi ${esc(first)}, your ${BRAND} account was just signed in to from a device we haven't seen before.`
      ) +
        panel(rows, "Sign-in details") +
        callout(
          `If this was you, no action is needed. If it wasn't, change your password now and contact ${mailto}.`,
          "warn"
        ),
      `Signed in ${formatDateTime(params.when)} from a new device.`,
      { eyebrow: "Security", tone: "warn" }
    ),
    text: `Hi ${first},

Your ${BRAND} account was signed in to from a new device.

When: ${formatDateTime(params.when)}${params.device ? `\nDevice: ${params.device}` : ""}${params.ipAddress ? `\nIP address: ${params.ipAddress}` : ""}

If this wasn't you, change your password now and contact ${params.supportEmail}.`,
  }
}

export function accountSuspendedEmail(params: {
  fullName: string
  reason: string | null
  supportEmail: string
}): Email {
  const first = firstNameOf(params.fullName)
  const mailto = mailLink(params.supportEmail)

  return {
    subject: "Your account has been suspended",
    html: layout(
      "Your account has been suspended",
      paragraph(
        `Hi ${esc(first)}, your ${BRAND} account has been suspended. You will not be able to sign in, trade, or request a withdrawal until it is restored.`
      ) +
        reasonPanel(params.reason) +
        paragraph(
          `Your balance is unaffected. To resolve this, reply to this email or contact ${mailto}.`
        ),
      "Access is paused. Your balance is unaffected.",
      { eyebrow: "Account status", tone: "danger" }
    ),
    text: `Hi ${first},

Your ${BRAND} account has been suspended. You cannot sign in, trade, or request a withdrawal until it is restored.${reasonText(params.reason)}

Your balance is unaffected. Contact ${params.supportEmail} to resolve this.`,
  }
}

export function accountReactivatedEmail(params: {
  fullName: string
  appUrl: string
}): Email {
  const first = firstNameOf(params.fullName)

  return {
    subject: "Your account has been restored",
    html: layout(
      "Your account has been restored",
      paragraph(
        `Hi ${esc(first)}, the suspension on your ${BRAND} account has been lifted. Full access to trading, deposits and withdrawals is available again.`
      ) + button(`${params.appUrl}/login`, "Sign in to your account", "success"),
      "Full access has been restored to your account.",
      { eyebrow: "Account status", tone: "success" }
    ),
    text: `Hi ${first},

The suspension on your ${BRAND} account has been lifted and full access is available again.

Sign in: ${params.appUrl}/login`,
  }
}

// ---------------------------------------------------------------------------
// Deposits
// ---------------------------------------------------------------------------

export function depositSubmittedEmail(params: {
  fullName: string
  amount: string
  method: string
  reference: string | null
}): Email {
  const first = firstNameOf(params.fullName)

  const rows: Array<[string, string]> = [["Method", params.method]]
  if (params.reference?.trim()) rows.push(["Reference", params.reference.trim()])

  return {
    subject: "We've received your deposit request",
    html: layout(
      "Deposit request received",
      paragraph(
        `Hi ${esc(first)}, we've received your deposit request and our team is verifying the payment.`
      ) +
        amountHero(money(params.amount), "Pending verification", "brand") +
        panel(rows, "Payment details") +
        paragraph(
          "Nothing has been credited yet — your balance updates the moment the payment is confirmed, and we'll email you either way."
        ),
      `Verifying your ${money(params.amount)} deposit — nothing credited yet.`,
      { eyebrow: "Deposit", tone: "brand" }
    ),
    text: `Hi ${first},

We've received your deposit request and are verifying the payment.

Amount: ${money(params.amount)}
Method: ${params.method}${params.reference?.trim() ? `\nReference: ${params.reference.trim()}` : ""}

Nothing has been credited yet. We'll email you as soon as the payment is confirmed.`,
  }
}

export function depositApprovedEmail(params: {
  fullName: string
  amount: string
  newBalance: string
}): Email {
  const first = firstNameOf(params.fullName)

  return {
    subject: "Your deposit has been credited",
    html: layout(
      "Deposit confirmed",
      paragraph(
        `Hi ${esc(first)}, your deposit has been verified and credited to your account.`
      ) +
        amountHero(money(params.amount), "Credited to your account", "success") +
        panel([["New balance", money(params.newBalance)]]),
      `${money(params.amount)} is now available in your account.`,
      { eyebrow: "Deposit", tone: "success" }
    ),
    text: `Hi ${first},

Your deposit of ${money(params.amount)} has been verified and credited.

New balance: ${money(params.newBalance)}`,
  }
}

export function depositRejectedEmail(params: {
  fullName: string
  amount: string
  reason: string | null
}): Email {
  const first = firstNameOf(params.fullName)

  return {
    subject: "We couldn't verify your deposit",
    html: layout(
      "Deposit not verified",
      paragraph(
        `Hi ${esc(first)}, we were unable to verify your deposit of ${money(params.amount)}.`
      ) +
        reasonPanel(params.reason) +
        paragraph(
          "No funds have been credited and nothing has been taken from your balance. Please check the payment details and submit again, or contact support."
        ),
      `We couldn't verify your ${money(params.amount)} deposit.`,
      { eyebrow: "Deposit", tone: "danger" }
    ),
    text: `Hi ${first},

We couldn't verify your deposit of ${money(params.amount)}.${reasonText(params.reason)}

No funds were credited. Please check the payment details and submit again, or contact support.`,
  }
}

// ---------------------------------------------------------------------------
// Withdrawals
// ---------------------------------------------------------------------------

export function withdrawalSubmittedEmail(params: {
  fullName: string
  amount: string
  fee: string
  method: string
}): Email {
  const first = firstNameOf(params.fullName)

  return {
    subject: "Withdrawal request received",
    html: layout(
      "Withdrawal request received",
      paragraph(
        `Hi ${esc(first)}, we've received your withdrawal request and it's now awaiting review.`
      ) +
        amountHero(money(params.amount), "Awaiting review", "brand") +
        panel(
          [
            ["Fee", money(params.fee)],
            ["Method", params.method],
          ],
          "Request details"
        ) +
        paragraph(
          "These funds are on hold and are no longer available to trade while the request is reviewed."
        ),
      `${money(params.amount)} is on hold pending review.`,
      { eyebrow: "Withdrawal", tone: "brand" }
    ),
    text: `Hi ${first},

We've received your withdrawal request and it's awaiting review.

Amount: ${money(params.amount)}
Fee: ${money(params.fee)}
Method: ${params.method}

These funds are on hold and are no longer available to trade while the request is reviewed.`,
  }
}

export function withdrawalApprovedEmail(params: {
  fullName: string
  amount: string
  method: string
  newBalance: string
}): Email {
  const first = firstNameOf(params.fullName)

  return {
    subject: "Your withdrawal has been approved",
    html: layout(
      "Withdrawal approved",
      paragraph(
        `Hi ${esc(first)}, your withdrawal has been approved and the payment is on its way.`
      ) +
        amountHero(money(params.amount), "On its way to you", "success") +
        panel(
          [
            ["Method", params.method],
            ["Remaining balance", money(params.newBalance)],
          ],
          "Payment details"
        ) +
        paragraph(
          "Depending on your bank or network, funds can take a short while to appear."
        ),
      `${money(params.amount)} approved and on its way.`,
      { eyebrow: "Withdrawal", tone: "success" }
    ),
    text: `Hi ${first},

Your withdrawal of ${money(params.amount)} via ${params.method} has been approved and the payment is on its way.

Remaining balance: ${money(params.newBalance)}

Depending on your bank or network, funds can take a short while to appear.`,
  }
}

export function withdrawalRejectedEmail(params: {
  fullName: string
  amount: string
  reason: string | null
}): Email {
  const first = firstNameOf(params.fullName)

  return {
    subject: "Your withdrawal was declined",
    html: layout(
      "Withdrawal declined",
      paragraph(
        `Hi ${esc(first)}, your withdrawal request for ${money(params.amount)} was declined.`
      ) +
        reasonPanel(params.reason) +
        paragraph(
          "The funds have been released back into your balance and are available to trade or withdraw again."
        ),
      `${money(params.amount)} released back into your balance.`,
      { eyebrow: "Withdrawal", tone: "danger" }
    ),
    text: `Hi ${first},

Your withdrawal of ${money(params.amount)} was declined.${reasonText(params.reason)}

The funds have been released back into your balance.`,
  }
}

export function withdrawalCancelledEmail(params: {
  fullName: string
  amount: string
  newBalance: string
}): Email {
  const first = firstNameOf(params.fullName)

  return {
    subject: "Your withdrawal was cancelled",
    html: layout(
      "Withdrawal cancelled",
      paragraph(
        `Hi ${esc(first)}, your withdrawal request for ${money(params.amount)} has been cancelled and the hold on those funds is lifted.`
      ) +
        amountHero(money(params.amount), "Released back to you", "warn") +
        panel([["Available balance", money(params.newBalance)]]) +
        callout(
          "If you didn't cancel this request, contact support straight away."
        ),
      `${money(params.amount)} is available again.`,
      { eyebrow: "Withdrawal", tone: "warn" }
    ),
    text: `Hi ${first},

Your withdrawal request for ${money(params.amount)} has been cancelled and the hold is lifted.

Available balance: ${money(params.newBalance)}

If you didn't cancel this request, contact support straight away.`,
  }
}

/**
 * Carries the PIN itself.
 *
 * This is a deliberate trade the operator made with their eyes open: the PIN is
 * a second factor, and email already controls password reset, so an inbox that
 * falls into the wrong hands can now both reset the password and clear the PIN
 * check. It ships this way because relaying every PIN by hand was costing more
 * in practice than the separation was buying.
 *
 * What the copy must therefore NOT say is the old line about never sending a
 * PIN by email — we now do. The warning that survives is the one still true and
 * still useful: nobody, staff included, should ever ask them to hand it over.
 */
/**
 * Carries the PIN itself.
 *
 * This is a deliberate trade the operator made with their eyes open: the PIN is
 * a second factor, and email already controls password reset, so an inbox that
 * falls into the wrong hands can now both reset the password and clear the PIN
 * check. It ships this way because relaying every PIN by hand was costing more
 * in practice than the separation was buying.
 *
 * Two things the copy has to get right, and they pull against each other.
 *
 * The client will often ALSO be sent this PIN by their account manager in chat.
 * If the email does not say so, a legitimate message from the desk looks exactly
 * like the scam the email just warned them about — and the honest ones are the
 * people who will hesitate. So the mail states plainly that this happens and
 * that the two will match.
 *
 * But "your manager may send it to you" must not decay into "share it when
 * asked". The line that survives is therefore about DIRECTION, not about who:
 * it may be sent TO them, it is never to be sent BACK — to anyone, staff
 * included. That distinction is the whole security rule, so it is stated as a
 * rule rather than as a caveat.
 */
export function withdrawalPinEmail(params: {
  fullName: string
  pin: string
  expiresInMinutes: number
}): Email {
  const first = firstNameOf(params.fullName)
  const window = describeMinutes(params.expiresInMinutes)

  return {
    subject: "Your withdrawal PIN",
    html: layout(
      "Your withdrawal PIN",
      paragraph(
        `Hi ${esc(first)}, here is the PIN for the withdrawal you are making.`
      ) +
        codeHero(params.pin, "Your withdrawal PIN") +
        paragraph(
          `It expires in ${esc(window)} and can only be used once. Enter it on the withdrawal page to confirm your request.`
        ) +
        callout(
          "Your account manager may also send you this same PIN in your chat with them. That is normal — it will be the same number you see above. Checking that the two match is a good habit.",
          "info"
        ) +
        callout(
          "Never send this PIN to anyone. We may send a PIN to you, but nobody from Sterling Edge Trade will ever ask you to send one back, read it out, or forward it — not by email, chat or phone. If someone asks, it is not us.",
          "warn"
        ),
      `Your withdrawal PIN is ${params.pin} — it expires in ${window}.`,
      { eyebrow: "Withdrawal security", tone: "warn" }
    ),
    text: `Hi ${first},

Your withdrawal PIN is ${params.pin}

It expires in ${window} and can only be used once. Enter it on the withdrawal page to confirm your request.

Your account manager may also send you this same PIN in your chat with them. That is normal — it will be the same number shown above, and checking that the two match is a good habit.

Never send this PIN to anyone. We may send a PIN to you, but nobody from Sterling Edge Trade will ever ask you to send one back, read it out, or forward it — not by email, chat or phone. If someone asks, it is not us.`,
  }
}

export function withdrawalPinRevokedEmail(params: {
  fullName: string
}): Email {
  const first = firstNameOf(params.fullName)

  return {
    subject: "Your withdrawal PIN was cancelled",
    html: layout(
      "Your withdrawal PIN was cancelled",
      paragraph(
        `Hi ${esc(first)}, the withdrawal PIN issued for your account has been cancelled and can no longer be used.`
      ) +
        paragraph(
          "If you still need to withdraw, contact your account manager for a new PIN."
        ) +
        callout(
          "If someone contacts you asking for the old PIN, it is not us. We never ask for it.",
          "warn"
        ),
      "The PIN issued for your account is no longer valid.",
      { eyebrow: "Withdrawal security", tone: "neutral" }
    ),
    text: `Hi ${first},

The withdrawal PIN issued for your account has been cancelled and can no longer be used.

If you still need to withdraw, contact your account manager for a new PIN. We will never ask you for a PIN.`,
  }
}

// ---------------------------------------------------------------------------
// Plans and balance
// ---------------------------------------------------------------------------

export function subscriptionConfirmedEmail(params: {
  fullName: string
  planName: string
  principal: string
  dailyReturnPercent: string
  durationDays: number
  endsAt: Date
  newBalance: string
}): Email {
  const first = firstNameOf(params.fullName)

  return {
    subject: `Your ${params.planName} plan is active`,
    html: layout(
      `Your ${esc(params.planName)} plan is active`,
      paragraph(
        `Hi ${esc(first)}, your capital has been committed and the plan is now running.`
      ) +
        amountHero(money(params.principal), "Principal committed", "success") +
        panel(
          [
            ["Plan", params.planName],
            ["Daily return", `${params.dailyReturnPercent}%`],
            ["Duration", `${params.durationDays} days`],
            ["Matures on", formatDate(params.endsAt)],
            ["Available balance", money(params.newBalance)],
          ],
          "Plan terms"
        ) +
        paragraph(
          "Returns accrue daily and are credited straight to your balance. You can cancel early from the Plans page — the principal is returned, and payouts already credited stay with you."
        ),
      `${money(params.principal)} committed — matures ${formatDate(params.endsAt)}.`,
      { eyebrow: "Investment plan", tone: "success" }
    ),
    text: `Hi ${first},

Your ${params.planName} plan is active.

Principal: ${money(params.principal)}
Daily return: ${params.dailyReturnPercent}%
Duration: ${params.durationDays} days
Matures on: ${formatDate(params.endsAt)}
Available balance: ${money(params.newBalance)}

Returns accrue daily and are credited to your balance.`,
  }
}

export function subscriptionCompletedEmail(params: {
  fullName: string
  planName: string
  principal: string
  totalEarned: string
  newBalance: string
}): Email {
  const first = firstNameOf(params.fullName)

  return {
    subject: `Your ${params.planName} plan has matured`,
    html: layout(
      `Your ${esc(params.planName)} plan has matured`,
      paragraph(
        `Hi ${esc(first)}, your plan has run its full term. The principal has been returned to your balance alongside everything it earned.`
      ) +
        amountHero(money(params.totalEarned), "Total earned", "success") +
        panel(
          [
            ["Principal returned", money(params.principal)],
            ["New balance", money(params.newBalance)],
          ],
          "Plan summary"
        ) +
        paragraph(
          "The funds are available now — withdraw them, or put them into another plan."
        ),
      `${money(params.principal)} returned plus ${money(params.totalEarned)} earned.`,
      { eyebrow: "Investment plan", tone: "success" }
    ),
    text: `Hi ${first},

Your ${params.planName} plan has matured.

Principal returned: ${money(params.principal)}
Total earned: ${money(params.totalEarned)}
New balance: ${money(params.newBalance)}

The funds are available now.`,
  }
}

export function subscriptionCancelledEmail(params: {
  fullName: string
  planName: string
  principal: string
  newBalance: string
}): Email {
  const first = firstNameOf(params.fullName)

  return {
    subject: `Your ${params.planName} plan was cancelled`,
    html: layout(
      `Your ${esc(params.planName)} plan was cancelled`,
      paragraph(
        `Hi ${esc(first)}, the plan has been closed early and your principal is back in your balance.`
      ) +
        amountHero(money(params.principal), "Principal returned", "warn") +
        panel([["Available balance", money(params.newBalance)]]) +
        paragraph(
          "Returns already credited stay with you. No further returns will accrue on this plan."
        ),
      `${money(params.principal)} returned to your balance.`,
      { eyebrow: "Investment plan", tone: "warn" }
    ),
    text: `Hi ${first},

Your ${params.planName} plan was cancelled early.

Principal returned: ${money(params.principal)}
Available balance: ${money(params.newBalance)}

Returns already credited stay with you. No further returns will accrue.`,
  }
}

export function accountCreditedEmail(params: {
  fullName: string
  amount: string
  description: string | null
  newBalance: string
}): Email {
  const first = firstNameOf(params.fullName)
  const details = params.description?.trim()

  return {
    subject: "Your account has been credited",
    html: layout(
      "Account credited",
      paragraph(
        `Hi ${esc(first)}, funds have been added to your account.`
      ) +
        amountHero(money(params.amount), "Added to your balance", "success") +
        panel([
          ...(details ? ([["Details", details]] as Array<[string, string]>) : []),
          ["New balance", money(params.newBalance)],
        ]),
      `${money(params.amount)} added to your balance.`,
      { eyebrow: "Account", tone: "success" }
    ),
    text: `Hi ${first},

Your account was credited ${money(params.amount)}.${details ? `\n\nDetails: ${details}` : ""}

New balance: ${money(params.newBalance)}`,
  }
}

/**
 * A position booked by the desk, with the cash that came with it.
 *
 * Separate from `accountCreditedEmail` rather than a variant of it: the
 * interesting part here is the position. Someone who wired money for 0.05 BTC
 * wants to see the units they were credited, not just a dollar figure, and
 * folding that into the generic credit mail would have made every other credit
 * carry two empty rows.
 *
 * Only sent when the ledger actually moved. Recording an asset the account was
 * never funded for is bookkeeping, not news.
 */
export function holdingAddedEmail(params: {
  fullName: string
  name: string
  symbol: string
  units: string
  valueUsd: string
  newBalance: string
}): Email {
  const first = firstNameOf(params.fullName)
  const position = `${formatUnits(params.units)} ${params.symbol}`

  return {
    subject: `${params.name} added to your portfolio`,
    html: layout(
      "Position added",
      paragraph(
        `Hi ${esc(first)}, a new position has been added to your portfolio and the matching funds credited to your balance.`
      ) +
        amountHero(money(params.valueUsd), "Added to your balance", "success") +
        panel(
          [
            ["Asset", params.name],
            ["Position", position],
            ["Value", money(params.valueUsd)],
            ["New balance", money(params.newBalance)],
          ],
          "Position details"
        ),
      // layout() interpolates the preheader raw — the symbol is admin-entered.
      `${esc(position)} — ${money(params.valueUsd)} added to your balance.`,
      { eyebrow: "Portfolio", tone: "success" }
    ),
    text: `Hi ${first},

A new position has been added to your portfolio and the matching funds credited to your balance.

Asset: ${params.name}
Position: ${position}
Value: ${money(params.valueUsd)}

New balance: ${money(params.newBalance)}`,
  }
}

/**
 * Profit, as its own event.
 *
 * Split from `accountCreditedEmail` because they were indistinguishable in an
 * inbox: earning a return and having a typo corrected both arrived as "Your
 * account has been credited". Profit is what the platform sells, so it gets the
 * subject line, the eyebrow and the caption that say so.
 */
export function profitCreditedEmail(params: {
  fullName: string
  amount: string
  description: string | null
  newBalance: string
}): Email {
  const first = firstNameOf(params.fullName)
  const details = params.description?.trim()

  return {
    subject: `Profit credited — ${money(params.amount)}`,
    html: layout(
      "Profit credited",
      paragraph(
        `Hi ${esc(first)}, your account has earned a return and it is already in your balance.`
      ) +
        amountHero(money(params.amount), "Profit earned", "success") +
        panel(
          [
            ...(details
              ? ([["Details", details]] as Array<[string, string]>)
              : []),
            ["New balance", money(params.newBalance)],
          ],
          "Summary"
        ),
      `${money(params.amount)} profit credited to your account.`,
      { eyebrow: "Profit", tone: "success" }
    ),
    text: `Hi ${first},

Your account has earned a return of ${money(params.amount)} and it is already in your balance.${details ? `\n\nDetails: ${details}` : ""}

New balance: ${money(params.newBalance)}`,
  }
}

/**
 * Money leaving an account by an admin's hand.
 *
 * The counterpart to `accountCreditedEmail`, and the last silent path: every
 * way money *arrived* notified the user, while a manual debit and a reversed
 * holding took it back without a word.
 *
 * Carries a support address, because the one thing someone will want after
 * reading this is a way to ask why. Amber rather than red — a correction is
 * routine, and dressing it as an alarm invites a support ticket per entry.
 */
export function accountDebitedEmail(params: {
  fullName: string
  amount: string
  description: string | null
  newBalance: string
  supportEmail: string
}): Email {
  const first = firstNameOf(params.fullName)
  const details = params.description?.trim()
  const mailto = mailLink(params.supportEmail)

  return {
    subject: `Funds removed from your account — ${money(params.amount)}`,
    html: layout(
      "Funds removed",
      paragraph(
        `Hi ${esc(first)}, an adjustment has been made to your account and funds have been removed from your balance.`
      ) +
        amountHero(money(params.amount), "Removed from your balance", "warn") +
        panel(
          [
            ...(details
              ? ([["Reason", details]] as Array<[string, string]>)
              : []),
            ["New balance", money(params.newBalance)],
          ],
          "Summary"
        ) +
        paragraph(
          `If this does not look right, reply to this email or contact ${mailto} and we will look into it.`
        ),
      `${money(params.amount)} removed from your balance.`,
      { eyebrow: "Account", tone: "warn" }
    ),
    text: `Hi ${first},

An adjustment has been made to your account and ${money(params.amount)} has been removed from your balance.${details ? `\n\nReason: ${details}` : ""}

New balance: ${money(params.newBalance)}

If this does not look right, contact ${params.supportEmail}.`,
  }
}
