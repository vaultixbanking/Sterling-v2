import type { Request, Response } from "express"

import type { ErrorCode, ErrorDetail } from "./errors.js"

/**
 * One response envelope for the whole API.
 *
 * SwiftEdge returned at least six different shapes — `{ message }`,
 * `{ success, message }`, `{ message, resolution }`, `{ success, error }`,
 * bare arrays, and plain text — which made the frontend guess every time.
 */

export interface SuccessBody<T> {
  success: true
  data: T
}

export interface ErrorBody {
  success: false
  error: {
    code: ErrorCode
    message: string
    details?: ErrorDetail[]
  }
}

export function ok<T>(res: Response, data: T, status = 200): Response {
  const body: SuccessBody<T> = { success: true, data }
  return res.status(status).json(body)
}

export function created<T>(res: Response, data: T): Response {
  return ok(res, data, 201)
}

export function noContent(res: Response): Response {
  return res.status(204).end()
}

export interface PageMeta {
  page: number
  limit: number
  total: number
  pages: number
}

export function paginated<T>(
  res: Response,
  items: T[],
  meta: PageMeta
): Response {
  return ok(res, { items, meta })
}

export function buildPageMeta(
  page: number,
  limit: number,
  total: number
): PageMeta {
  return { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
}

/**
 * Best-effort client IP. Trusts the proxy header only because the app runs
 * behind one in production; `app.set('trust proxy', 1)` gates it.
 */
export function clientIp(req: Request): string | undefined {
  return req.ip ?? req.socket.remoteAddress ?? undefined
}
