import { Role } from "@prisma/client"
import type { NextFunction, Request, Response } from "express"

import { ForbiddenError, UnauthenticatedError } from "../lib/errors.js"

/**
 * Role gate. Must be mounted after `authenticate`.
 *
 * This is the single most important fix in the rewrite. In SwiftEdge every
 * `/admin/*` route was guarded by the *user* middleware, and the one that was
 * named `authenticateAdmin` only verified the signature — it never checked
 * `role`. Because user and admin tokens shared a secret, any customer could
 * credit themselves unlimited profit, rewrite the platform's deposit wallet
 * addresses, mint withdrawal PINs, and approve their own withdrawals.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new UnauthenticatedError())
      return
    }

    if (!roles.includes(req.auth.role)) {
      next(new ForbiddenError())
      return
    }

    next()
  }
}

export const requireAdmin = requireRole(Role.ADMIN)
