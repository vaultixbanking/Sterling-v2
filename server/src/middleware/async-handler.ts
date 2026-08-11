import type { NextFunction, Request, RequestHandler, Response } from "express"

/**
 * Wraps an async handler so a rejected promise reaches the error middleware.
 *
 * Express 5 forwards rejections automatically, but wrapping keeps the intent
 * explicit and keeps handlers working if the signature ever changes.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next)
  }
}
