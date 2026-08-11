import rateLimit, { ipKeyGenerator, type Options } from "express-rate-limit"

import { isTest } from "../config/env.js"
import { AppError } from "../lib/errors.js"

/**
 * SwiftEdge had no rate limiting anywhere. `/login`, `/admin/login`,
 * `/verify-pin` and `/request-reset` were all wide open — and since PINs were
 * only 4 digits and unauthenticated, the entire keyspace was 10,000 requests.
 */

function build(options: Partial<Options>) {
  return rateLimit({
    standardHeaders: "draft-7",
    legacyHeaders: false,
    // Limits would make the test suite flaky and prove nothing.
    skip: () => isTest,
    handler: (_req, _res, next) => {
      next(
        new AppError(
          429,
          "RATE_LIMITED",
          "Too many requests. Please wait a moment and try again."
        )
      )
    },
    ...options,
  })
}

/** Sign-in and registration — where guessing actually gets an attacker somewhere. */
export const authLimiter = build({
  windowMs: 15 * 60 * 1000,
  limit: 10,
})

/**
 * Token refresh, which every page load performs once. Ten per quarter-hour —
 * the sign-in ceiling — locks a normal user out of their own dashboard after a
 * few reloads. The ceiling here is high because the endpoint is not a guessing
 * target: it needs a valid httpOnly cookie, and rotation means a stolen token
 * is single-use anyway.
 */
export const refreshLimiter = build({
  windowMs: 15 * 60 * 1000,
  limit: 60,
})

/** Password reset requests — expensive (sends mail) and enumeration-adjacent. */
export const passwordResetLimiter = build({
  windowMs: 60 * 60 * 1000,
  limit: 5,
})

/**
 * Withdrawal PIN attempts, keyed per authenticated user *and* per IP so a
 * single account cannot be brute-forced from a botnet.
 */
export const pinLimiter = build({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) =>
    req.auth?.userId ?? ipKeyGenerator(req.ip ?? "unknown"),
})

/** Broad ceiling for everything else. */
export const generalLimiter = build({
  windowMs: 60 * 1000,
  limit: 120,
})
