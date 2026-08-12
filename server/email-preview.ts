// Temporary: renders every template with sample data into one review page.
import { writeFileSync } from "node:fs"

import * as t from "./src/services/email/templates.js"
import type { Email } from "./src/services/email/templates.js"

const APP = "https://sterlingedgetrade.com"
const SUPPORT = "support@sterlingedgetrade.com"
const NAME = "Daniel Mercer"

const soon = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000)

// Grouped the way a reviewer thinks about them, not the way the file lists them.
const GROUPS: Array<[string, Array<[string, Email]>]> = [
  [
    "Account & access",
    [
      ["welcomeEmail", t.welcomeEmail({ fullName: NAME, username: "dmercer", uid: "A7F3C210", appUrl: APP })],
      ["emailVerificationEmail", t.emailVerificationEmail({ fullName: NAME, verifyUrl: `${APP}/verify-email?token=8f3a2c`, ttlMinutes: 60 })],
      ["passwordResetEmail", t.passwordResetEmail({ fullName: NAME, resetUrl: `${APP}/reset-password?token=b91d4e`, ttlMinutes: 30 })],
      ["passwordChangedEmail", t.passwordChangedEmail({ fullName: NAME, supportEmail: SUPPORT })],
      ["loginAlertEmail", t.loginAlertEmail({ fullName: NAME, when: new Date("2026-08-11T14:32:00Z"), ipAddress: "102.89.34.17", device: "Chrome on macOS", supportEmail: SUPPORT })],
      ["accountSuspendedEmail", t.accountSuspendedEmail({ fullName: NAME, reason: "Unusual activity flagged during a routine compliance review.", supportEmail: SUPPORT })],
      ["accountSuspendedEmail (no reason)", t.accountSuspendedEmail({ fullName: NAME, reason: null, supportEmail: SUPPORT })],
      ["accountReactivatedEmail", t.accountReactivatedEmail({ fullName: NAME, appUrl: APP })],
    ],
  ],
  [
    "Deposits",
    [
      ["depositSubmittedEmail", t.depositSubmittedEmail({ fullName: NAME, amount: "2500.00", method: "Bank transfer", reference: "FT26081143902" })],
      ["depositSubmittedEmail (no ref)", t.depositSubmittedEmail({ fullName: NAME, amount: "2500.00", method: "Crypto", reference: null })],
      ["depositApprovedEmail", t.depositApprovedEmail({ fullName: NAME, amount: "2500.00", newBalance: "12750.50" })],
      ["depositRejectedEmail", t.depositRejectedEmail({ fullName: NAME, amount: "2500.00", reason: "The uploaded proof of payment was not legible. Please re-submit a clearer photo." })],
      ["depositRejectedEmail (no reason)", t.depositRejectedEmail({ fullName: NAME, amount: "2500.00", reason: null })],
    ],
  ],
  [
    "Withdrawals",
    [
      ["withdrawalSubmittedEmail", t.withdrawalSubmittedEmail({ fullName: NAME, amount: "1200.00", fee: "60.00", method: "Crypto" })],
      ["withdrawalApprovedEmail", t.withdrawalApprovedEmail({ fullName: NAME, amount: "1200.00", method: "Crypto", newBalance: "11490.50" })],
      ["withdrawalRejectedEmail", t.withdrawalRejectedEmail({ fullName: NAME, amount: "1200.00", reason: "The destination wallet address did not match the network selected." })],
      ["withdrawalCancelledEmail", t.withdrawalCancelledEmail({ fullName: NAME, amount: "1200.00", newBalance: "12750.50" })],
      ["withdrawalPinEmail", t.withdrawalPinEmail({ fullName: NAME, expiresInMinutes: 30 })],
      ["withdrawalPinRevokedEmail", t.withdrawalPinRevokedEmail({ fullName: NAME })],
    ],
  ],
  [
    "Investment plans",
    [
      ["subscriptionConfirmedEmail", t.subscriptionConfirmedEmail({ fullName: NAME, planName: "Gold", principal: "25000.00", dailyReturnPercent: "2.50", durationDays: 30, endsAt: soon, newBalance: "3750.00" })],
      ["subscriptionCompletedEmail", t.subscriptionCompletedEmail({ fullName: NAME, planName: "Gold", principal: "25000.00", totalEarned: "18750.00", newBalance: "47500.00" })],
      ["subscriptionCancelledEmail", t.subscriptionCancelledEmail({ fullName: NAME, planName: "Gold", principal: "25000.00", newBalance: "28750.00" })],
    ],
  ],
  [
    "Adjustments",
    [
      ["accountCreditedEmail", t.accountCreditedEmail({ fullName: NAME, amount: "500.00", description: "Referral bonus for August", newBalance: "13250.50" })],
      ["accountCreditedEmail (no note)", t.accountCreditedEmail({ fullName: NAME, amount: "500.00", description: null, newBalance: "13250.50" })],
    ],
  ],
]

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

let count = 0
const sections = GROUPS.map(([group, items]) => {
  const cards = items
    .map(([name, email]) => {
      count += 1
      return `
      <article class="card" id="${esc(name.replace(/[^a-zA-Z]/g, ""))}">
        <header>
          <div class="fn"><code>${esc(name)}</code></div>
          <div class="subj"><span>Subject</span>${esc(email.subject)}</div>
        </header>
        <iframe loading="lazy" srcdoc="${esc(email.html)}" onload="fit(this)"></iframe>
        <details>
          <summary>Plain-text fallback</summary>
          <pre>${esc(email.text)}</pre>
        </details>
      </article>`
    })
    .join("")

  return `<section><h2>${esc(group)} <span class="n">${items.length}</span></h2><div class="grid">${cards}</div></section>`
}).join("")

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sterling Edge Trade — email templates</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; background:#0b1120; color:#e2e8f0;
         font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
  .top { position:sticky; top:0; z-index:10; background:rgba(11,17,32,.92);
         backdrop-filter:blur(8px); border-bottom:1px solid #1e293b; padding:18px 24px; }
  .top h1 { margin:0; font-size:17px; letter-spacing:-.2px; }
  .top p { margin:4px 0 0; font-size:13px; color:#94a3b8; }
  main { padding:24px; max-width:1600px; margin:0 auto; }
  section { margin:0 0 40px; }
  h2 { font-size:13px; text-transform:uppercase; letter-spacing:.09em; color:#94a3b8;
       margin:0 0 14px; padding-bottom:8px; border-bottom:1px solid #1e293b; }
  h2 .n { color:#475569; margin-left:6px; }
  .grid { display:grid; gap:20px; grid-template-columns:repeat(auto-fill,minmax(420px,1fr)); }
  .card { background:#111a2e; border:1px solid #1e293b; border-radius:12px; overflow:hidden; }
  .card header { padding:12px 14px; border-bottom:1px solid #1e293b; }
  .fn code { font-size:12px; color:#60a5fa; }
  .subj { margin-top:6px; font-size:13px; color:#f1f5f9; }
  .subj span { display:block; font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:#64748b; }
  iframe { width:100%; border:0; display:block; background:#f8fafc; }
  details { border-top:1px solid #1e293b; }
  summary { cursor:pointer; padding:9px 14px; font-size:12px; color:#94a3b8; }
  pre { margin:0; padding:0 14px 14px; white-space:pre-wrap; font-size:11.5px;
        line-height:1.55; color:#94a3b8; }
  @media (max-width:900px){ .grid{ grid-template-columns:1fr; } }
</style>
</head>
<body>
<div class="top">
  <h1>Sterling Edge Trade — email templates</h1>
  <p>${count} renders across ${GROUPS.length} groups, sample data. Each frame is the real HTML the recipient receives.</p>
</div>
<main>${sections}</main>
<script>
  function fit(f){ try { f.style.height = (f.contentDocument.body.scrollHeight + 8) + 'px' } catch(e){ f.style.height='620px' } }
  addEventListener('resize', () => document.querySelectorAll('iframe').forEach(fit))
</script>
</body>
</html>`

const out = process.argv[2] ?? "email-preview.html"
writeFileSync(out, page)
console.log(`Wrote ${out} — ${count} renders.`)
