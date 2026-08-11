import type { Role, User } from "@prisma/client"
import type { CookieOptions, Response } from "express"
import jwt from "jsonwebtoken"

import { REFRESH_COOKIE } from "../../config/constants.js"
import { env, isProduction } from "../../config/env.js"
import { generateToken, hashToken } from "../../lib/crypto.js"
import { UnauthenticatedError } from "../../lib/errors.js"
import { prisma } from "../../lib/prisma.js"

/**
 * Access tokens are short-lived JWTs sent in the Authorization header.
 * Refresh tokens are opaque random strings stored hashed in the database and
 * delivered in an httpOnly cookie, so XSS cannot read them and a stolen token
 * can be revoked.
 *
 * SwiftEdge issued a single 5-hour JWT with no refresh, no revocation and no
 * logout, and signed user and admin tokens with the same secret so a customer
 * token satisfied the admin middleware.
 */

export interface AccessTokenPayload {
  sub: string
  role: Role
  iat: number
  exp: number
}

const ISSUER = "sterling-edge"
const AUDIENCE = "sterling-edge-api"

export function signAccessToken(user: Pick<User, "id" | "role">): string {
  return jwt.sign({ role: user.role }, env.JWT_ACCESS_SECRET, {
    subject: user.id,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"],
  })
}

export interface IssuedRefresh {
  token: string
  expiresAt: Date
  /** Drives whether the cookie gets an expiry or dies with the browser. */
  persistent: boolean
}

export async function issueRefreshSession(
  userId: string,
  context: {
    userAgent?: string | undefined
    ip?: string | undefined
    persistent?: boolean | undefined
  }
): Promise<IssuedRefresh> {
  const token = generateToken(48)
  const expiresAt = new Date(
    Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
  )
  const persistent = context.persistent ?? true

  await prisma.refreshSession.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      userAgent: context.userAgent ?? null,
      ip: context.ip ?? null,
      persistent,
      expiresAt,
    },
  })

  return { token, expiresAt, persistent }
}

/**
 * Verifies a refresh token and rotates it: the presented session is revoked
 * and a fresh one issued. Rotation means a stolen token is usable at most once
 * before the legitimate client's next refresh invalidates it.
 */
export async function rotateRefreshSession(
  token: string,
  context: { userAgent?: string | undefined; ip?: string | undefined }
): Promise<{ user: User; refresh: IssuedRefresh }> {
  const session = await prisma.refreshSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  })

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw new UnauthenticatedError("Session expired. Please sign in again.")
  }

  const [, refresh] = await Promise.all([
    prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    }),
    // Carry the original "keep me signed in" choice across the rotation,
    // otherwise every refresh would quietly upgrade a browser-session login
    // into a persistent one.
    issueRefreshSession(session.userId, {
      ...context,
      persistent: session.persistent,
    }),
  ])

  return { user: session.user, refresh }
}

export async function revokeRefreshSession(token: string): Promise<void> {
  await prisma.refreshSession.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

/** Used on password change/reset — signs every device out. */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.refreshSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

function cookieOptions(expiresAt?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    // The API and the Next.js app are on different hosts in production, so the
    // cookie has to survive a cross-site request.
    sameSite: isProduction ? "none" : "lax",
    path: "/api/v1/auth",
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
    ...(expiresAt ? { expires: expiresAt } : {}),
  }
}

export function setRefreshCookie(res: Response, refresh: IssuedRefresh): void {
  // No `expires` makes it a session cookie — gone when the browser closes,
  // which is what "keep me signed in: off" has to mean to be worth offering.
  res.cookie(
    REFRESH_COOKIE,
    refresh.token,
    cookieOptions(refresh.persistent ? refresh.expiresAt : undefined)
  )
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, cookieOptions())
}
