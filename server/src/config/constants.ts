/** Cost factor for bcrypt. SwiftEdge used 10; 12 is the current sane default. */
export const BCRYPT_ROUNDS = 12

/** Refresh cookie name. */
export const REFRESH_COOKIE = "se_refresh"

/** Max JSON body size. SwiftEdge had no limit at all. */
export const JSON_BODY_LIMIT = "1mb"

/** Proof-of-payment upload constraints. */
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024 // 5 MB
export const UPLOAD_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const

/** Password-reset token lifetime. */
export const RESET_TOKEN_TTL_MINUTES = 30

/**
 * Email-verification token lifetime. Far longer than a reset token: a reset is
 * a live credential and should expire fast, whereas a confirmation link is
 * often opened on a different device hours later, and an expired one just
 * means an avoidable "resend" round trip.
 */
export const EMAIL_VERIFICATION_TTL_MINUTES = 24 * 60

/** Withdrawal PIN rules. */
export const PIN_ALLOWED_LENGTHS = [4, 6] as const
export const PIN_MAX_TTL_MINUTES = 60 * 24 * 7 // 7 days — SwiftEdge had no cap
export const PIN_DEFAULT_TTL_MINUTES = 30

/** Pagination guards. SwiftEdge had no max, and the frontend asked for 1000. */
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

/** Supported performance-chart windows. */
export const PERFORMANCE_PERIODS = ["7d", "1m", "3m", "1y", "all"] as const
export type PerformancePeriod = (typeof PERFORMANCE_PERIODS)[number]

/**
 * Usernames nobody may register.
 *
 * A customer called `support` or `sterling-security` can message other users
 * from inside the product and be believed — the name does the phishing on its
 * own. Blocking them costs a list; not blocking them costs a fraud case.
 *
 * Compared case-insensitively against the trimmed username, and applied to new
 * signups only: the 49 accounts migrated from the old platform keep whatever
 * they already have, because renaming someone's account out from under them is
 * a worse outcome than an awkward legacy handle.
 */
export const RESERVED_USERNAMES: readonly string[] = [
  "admin",
  "administrator",
  "root",
  "superuser",
  "sysadmin",
  "moderator",
  "mod",
  "staff",
  "team",
  "official",
  "support",
  "help",
  "helpdesk",
  "customercare",
  "customerservice",
  "service",
  "billing",
  "payments",
  "payment",
  "finance",
  "accounts",
  "accounting",
  "security",
  "verify",
  "verification",
  "noreply",
  "no_reply",
  "info",
  "contact",
  "sterling",
  "sterlingedge",
  "sterlingedgetrade",
  "sterlingsupport",
  "edgetrade",
  "system",
  "api",
  "bot",
  "null",
  "undefined",
  "me",
  "you",
  "test",
]

/** How many alternatives the signup form offers when a username is taken. */
export const USERNAME_SUGGESTION_COUNT = 5

/**
 * Categories an admin may write by hand from the adjustments endpoint.
 *
 * `WITHDRAWAL` and `PLAN_PRINCIPAL` are deliberately absent. Those are owned by
 * the withdrawal and plan flows, which pair every row with a request or
 * subscription record; a hand-written one would have no counterpart, so the
 * queue and the ledger would disagree about what happened.
 *
 * Each direction is valid for all five: a credit records the thing, a debit
 * reverses it. `sumCategory` nets the two, so a reversal moves the matching
 * dashboard figure back down.
 */
export const ADJUSTABLE_CATEGORIES = [
  "ADJUSTMENT",
  "DEPOSIT",
  "HOLDING",
  "PROFIT",
  "PLAN_PAYOUT",
] as const
