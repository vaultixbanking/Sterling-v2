import { Prisma } from "@prisma/client"
import type { NextFunction, Request, Response } from "express"
import { ZodError } from "zod"

import { isProduction } from "../config/env.js"
import {
  AppError,
  NotFoundError,
  ValidationError,
  isAppError,
  type ErrorDetail,
} from "../lib/errors.js"
import type { ErrorBody } from "../lib/http.js"
import { logger } from "../lib/logger.js"

/** Terminal 404 for unmatched routes. SwiftEdge had none. */
export function notFoundHandler(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  next(new NotFoundError(`Route ${req.method} ${req.path}`))
}

function normalise(error: unknown): AppError {
  if (isAppError(error)) return error

  if (error instanceof ZodError) {
    const details: ErrorDetail[] = error.issues.map((issue) => ({
      path: issue.path.map(String).join("."),
      message: issue.message,
    }))
    return new ValidationError("The request contains invalid data.", details)
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint — surface which field collided, not the raw SQL.
    if (error.code === "P2002") {
      const target = error.meta?.target
      const fields = Array.isArray(target) ? target.join(", ") : "value"
      return new AppError(409, "CONFLICT", `That ${fields} is already in use.`)
    }
    if (error.code === "P2025") {
      return new NotFoundError("Record")
    }
    if (error.code === "P2003") {
      return new AppError(
        409,
        "CONFLICT",
        "That operation conflicts with a related record."
      )
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return new AppError(
      500,
      "INTERNAL_ERROR",
      "A database query was malformed.",
      undefined,
      false
    )
  }

  // Body parser
  if (
    error instanceof SyntaxError &&
    "body" in error &&
    "status" in error &&
    error.status === 400
  ) {
    return new ValidationError("Request body is not valid JSON.")
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.too.large"
  ) {
    return new AppError(413, "PAYLOAD_TOO_LARGE", "Request body is too large.")
  }

  const message = error instanceof Error ? error.message : String(error)
  return new AppError(500, "INTERNAL_ERROR", message, undefined, false)
}

/**
 * The single funnel every error passes through.
 *
 * Unexpected errors are logged in full but reported generically. SwiftEdge
 * returned `error.message` — and at one route the entire error object — to the
 * client from five different handlers.
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    next(error)
    return
  }

  const appError = normalise(error)

  const context = {
    method: req.method,
    path: req.path,
    statusCode: appError.statusCode,
    code: appError.code,
    userId: req.auth?.userId,
  }

  if (appError.isOperational) {
    logger.warn(context, appError.message)
  } else {
    logger.error({ ...context, err: appError }, "Unhandled error")
  }

  const body: ErrorBody = {
    success: false,
    error: {
      code: appError.code,
      message:
        appError.isOperational || !isProduction
          ? appError.message
          : "Something went wrong. Please try again.",
      ...(appError.details ? { details: appError.details } : {}),
    },
  }

  res.status(appError.statusCode).json(body)
}
