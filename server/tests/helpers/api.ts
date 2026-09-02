import type { Express } from "express"
import request from "supertest"

import { createApp } from "../../src/app.js"
import { signAccessToken } from "../../src/modules/auth/token.service.js"

/**
 * HTTP-level test harness.
 *
 * The unit suites cover the ledger's arithmetic, but every admin endpoint was
 * hand-tested only — so the layer that actually decides what reaches those
 * functions (auth guards, Zod schemas, query-string parsing) had no coverage at
 * all. That is precisely where a bug hides in plain sight: `z.coerce.boolean()`
 * turning the string "false" into `true` is invisible to a service-level test,
 * because the service never sees the string.
 *
 * One app instance per run — `createApp()` builds a plain Express app with no
 * listener, so supertest can drive it directly.
 */
let cached: Express | null = null

export function app(): Express {
  cached ??= createApp()
  return cached
}

/** A signed access token for a user, exactly as the login route would issue. */
export function tokenFor(user: { id: string; role?: "USER" | "ADMIN" }): string {
  return signAccessToken({ id: user.id, role: user.role ?? "USER" })
}

type Method = "get" | "post" | "patch" | "delete"

/**
 * An authenticated request. Returns supertest's chainable Test, so callers can
 * still `.send()`, `.query()` and assert on the response themselves.
 */
export function as(
  user: { id: string; role?: "USER" | "ADMIN" },
  method: Method,
  path: string
) {
  const agent = request(app())
  return agent[method](`/api/v1${path}`).set(
    "Authorization",
    `Bearer ${tokenFor(user)}`
  )
}

/** An unauthenticated request, for asserting the guards actually guard. */
export function anon(method: Method, path: string) {
  const agent = request(app())
  return agent[method](`/api/v1${path}`)
}
