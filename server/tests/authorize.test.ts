import { Role } from "@prisma/client"
import type { NextFunction, Request, Response } from "express"
import { describe, expect, it, vi } from "vitest"

import { requireAdmin, requireRole } from "../src/middleware/authorize.js"

/**
 * The single most important regression in the whole rewrite.
 *
 * In SwiftEdge every `/admin/*` route was mounted behind `authenticateJWT` —
 * the *user* middleware — and the one named `authenticateAdmin` verified only
 * the signature, never the role. Because user and admin tokens shared a
 * secret, any customer could call every admin endpoint.
 */
describe("requireRole", () => {
  function invoke(auth: Request["auth"], guard = requireAdmin) {
    const req = { auth } as Request
    const res = {} as Response
    const next = vi.fn() as unknown as NextFunction
    guard(req, res, next)
    return next as unknown as ReturnType<typeof vi.fn>
  }

  it("rejects an unauthenticated request", () => {
    const next = invoke(undefined)
    const error = next.mock.calls[0]?.[0]
    expect(error).toBeDefined()
    expect(error.statusCode).toBe(401)
  })

  it("rejects a USER token on an admin route", () => {
    const next = invoke({ userId: "user-1", role: Role.USER })
    const error = next.mock.calls[0]?.[0]
    expect(error).toBeDefined()
    expect(error.statusCode).toBe(403)
    expect(error.code).toBe("FORBIDDEN")
  })

  it("allows an ADMIN token on an admin route", () => {
    const next = invoke({ userId: "admin-1", role: Role.ADMIN })
    expect(next).toHaveBeenCalledWith()
  })

  it("allows either role when both are permitted", () => {
    const guard = requireRole(Role.USER, Role.ADMIN)
    expect(invoke({ userId: "u", role: Role.USER }, guard)).toHaveBeenCalledWith()
    expect(invoke({ userId: "a", role: Role.ADMIN }, guard)).toHaveBeenCalledWith()
  })
})
