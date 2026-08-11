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
