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

  const refresh = await tokenService.issueRefreshSession(user.id, {
    ...requestContext(req),
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

export async function me(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.auth!.userId },
  })
  ok(res, { user: authService.toPublicUser(user) })
}
