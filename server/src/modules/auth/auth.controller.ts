import type { Request, Response } from "express"

import { REFRESH_COOKIE } from "../../config/constants.js"
import { UnauthenticatedError } from "../../lib/errors.js"
import { clientIp, created, noContent, ok } from "../../lib/http.js"
import { prisma } from "../../lib/prisma.js"
import * as authService from "./auth.service.js"
import * as tokenService from "./token.service.js"

function requestContext(req: Request) {
  return {
    userAgent: req.headers["user-agent"],
    ip: clientIp(req),
  }
}

export async function register(req: Request, res: Response): Promise<void> {
  const user = await authService.register(req.body)
  created(res, { user })
}

export async function login(req: Request, res: Response): Promise<void> {
  const user = await authService.login(req.body)
  const context = requestContext(req)

  // Awaited, and before the session is issued: the lookup compares against
  // prior sessions, so the new row must not exist yet or it matches itself and
  // the alert never fires. The email itself is fire-and-forget inside.
  await authService.notifyIfNewDevice(user, context)

  const refresh = await tokenService.issueRefreshSession(user.id, {
    ...context,
    persistent: req.body.remember as boolean,
  })
  tokenService.setRefreshCookie(res, refresh)

  await authService.recordLogin(user.id, clientIp(req))

  ok(res, {
    user: authService.toPublicUser(user),
    accessToken: tokenService.signAccessToken(user),
  })
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined
  if (!token) {
    throw new UnauthenticatedError("No active session.")
  }

  const { user, refresh: rotated } = await tokenService.rotateRefreshSession(
    token,
    requestContext(req)
  )
  tokenService.setRefreshCookie(res, rotated)

  ok(res, {
    user: authService.toPublicUser(user),
    accessToken: tokenService.signAccessToken(user),
  })
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined
  if (token) {
    await tokenService.revokeRefreshSession(token)
  }
  tokenService.clearRefreshCookie(res)
  noContent(res)
}

export async function logoutAll(req: Request, res: Response): Promise<void> {
  await tokenService.revokeAllSessions(req.auth!.userId)
  tokenService.clearRefreshCookie(res)
  noContent(res)
}

export async function forgotPassword(
  req: Request,
  res: Response
): Promise<void> {
  await authService.requestPasswordReset(req.body.email)

  // Identical response whether or not the address exists.
  ok(res, {
    message:
      "If an account exists for that address, a reset link is on its way.",
  })
}

export async function resetPassword(
  req: Request,
  res: Response
): Promise<void> {
  await authService.resetPassword(req.body.token, req.body.password)
  tokenService.clearRefreshCookie(res)
  ok(res, { message: "Password updated. Please sign in again." })
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const user = await authService.verifyEmail(req.body.token)
  ok(res, { user, message: "Your email address is confirmed." })
}

export async function resendVerification(
  req: Request,
  res: Response
): Promise<void> {
  await authService.requestEmailVerificationByEmail(req.body.email)

  // Identical response whether or not the address exists or is already
  // confirmed — otherwise this endpoint enumerates accounts.
  ok(res, {
    message:
      "If that address needs confirming, a new link is on its way.",
  })
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.auth!.userId },
  })
  ok(res, { user: authService.toPublicUser(user) })
}
