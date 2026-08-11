import type { NextFunction, Request, Response } from "express"
import jwt from "jsonwebtoken"

import { env } from "../config/env.js"
import { TokenExpiredError, UnauthenticatedError } from "../lib/errors.js"
import type { AccessTokenPayload } from "../modules/auth/token.service.js"

/**
 * Verifies the access token and populates `req.auth`.
 *
 * Differences from SwiftEdge, which had three separate copies of this logic:
 *  - the `Bearer` prefix is actually checked (`.split(' ')[1]` accepted
 *    `Foo <token>`);
 *  - the `role` claim is carried through rather than discarded, so
 *    `requireRole` has something to check;
 *  - an expired token is a 401, not a 403 or a 500.
 */
export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization

  if (!header?.startsWith("Bearer ")) {
    next(new UnauthenticatedError("Authorization header missing or malformed."))
    return
  }

  const token = header.slice("Bearer ".length).trim()
  if (!token) {
    next(new UnauthenticatedError("Authorization token missing."))
    return
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: "sterling-edge",
      audience: "sterling-edge-api",
    }) as AccessTokenPayload

    req.auth = { userId: payload.sub, role: payload.role }
    next()
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new TokenExpiredError())
      return
    }
    next(new UnauthenticatedError("Invalid authentication token."))
  }
}
