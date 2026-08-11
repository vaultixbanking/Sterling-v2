/**
 * Typed error taxonomy.
 *
 * Services throw these; a single error-handling middleware turns them into the
 * response envelope. SwiftEdge had no error middleware at all — a thrown error
 * produced Express's default HTML stack page, and five routes deliberately
 * leaked `error.message` (and once the whole error object) to the client.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "INVALID_CREDENTIALS"
  | "TOKEN_EXPIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INSUFFICIENT_FUNDS"
  | "INVALID_PIN"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR"

export interface ErrorDetail {
  path: string
  message: string
}

export class AppError extends Error {
  readonly statusCode: number
  readonly code: ErrorCode
  readonly details: ErrorDetail[] | undefined
  /** False for genuinely unexpected failures, which get logged at error level. */
  readonly isOperational: boolean

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details?: ErrorDetail[],
    isOperational = true
  ) {
    super(message)
    this.name = new.target.name
    this.statusCode = statusCode
    this.code = code
    this.details = details
    this.isOperational = isOperational
    Error.captureStackTrace?.(this, new.target)
  }
}

export class ValidationError extends AppError {
  constructor(message = "The request contains invalid data.", details?: ErrorDetail[]) {
    super(400, "VALIDATION_ERROR", message, details)
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Authentication required.") {
    super(401, "UNAUTHENTICATED", message)
  }
}

/**
 * Deliberately identical whether the account is missing or the password is
 * wrong. SwiftEdge returned 'Account not found' vs 'Incorrect password',
 * handing an attacker a free user-enumeration oracle.
 */
export class InvalidCredentialsError extends AppError {
  constructor(message = "Invalid credentials.") {
    super(401, "INVALID_CREDENTIALS", message)
  }
}

export class TokenExpiredError extends AppError {
  constructor(message = "Session expired. Please sign in again.") {
    super(401, "TOKEN_EXPIRED", message)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super(403, "FORBIDDEN", message)
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(404, "NOT_FOUND", `${resource} not found.`)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, "CONFLICT", message)
  }
}

export class InsufficientFundsError extends AppError {
  constructor(message = "Insufficient available balance.") {
    super(422, "INSUFFICIENT_FUNDS", message)
  }
}

export class InvalidPinError extends AppError {
  constructor(message = "That PIN is invalid, expired or already used.") {
    super(422, "INVALID_PIN", message)
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "A required service is unavailable.") {
    super(503, "SERVICE_UNAVAILABLE", message)
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}
