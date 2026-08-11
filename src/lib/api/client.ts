import type { ApiErrorCode, ApiErrorDetail, PublicUser } from "./types"

/**
 * The single HTTP path to the Sterling Edge API.
 *
 * Two things it owns that the rest of the app never has to think about:
 *
 *  - **The envelope.** Every response is `{ success, data }` or
 *    `{ success, error }`; callers only ever see `data`, or a thrown `ApiError`.
 *  - **The access token.** Held in a module closure, never in `localStorage`.
 *    When it expires, one refresh runs (shared by every concurrent caller) and
 *    the original request is retried once.
 *
 * SwiftEdge kept a raw JWT in `localStorage` under a key shared by users and
 * admins, read it in twelve places, and had no refresh at all — the session
 * simply died after five hours and a hand-rolled modal appeared.
 */

const BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"
).replace(/\/$/, "")

/* --------------------------------------------------------------- ApiError */

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  readonly details: ApiErrorDetail[]

  constructor(
    code: ApiErrorCode,
    message: string,
    status: number,
    details: ApiErrorDetail[] = []
  ) {
    super(message)
    this.name = "ApiError"
    this.code = code
    this.status = status
    this.details = details
  }

  /**
   * Field errors keyed by input name, with the server's `body.` / `query.`
   * prefix stripped so they drop straight onto a form.
   */
  fieldErrors(): Record<string, string> {
    const fields: Record<string, string> = {}
    for (const detail of this.details) {
      const field = detail.path.replace(/^(body|query|params)\./, "")
      fields[field] ??= detail.message
    }
    return fields
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/* ------------------------------------------------------------ token state */

let accessToken: string | null = null

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string | null): void {
  accessToken = token
}

/**
 * The AuthProvider subscribes so a background refresh (or its failure) updates
 * the UI without every caller having to handle it.
 */
type SessionListener = (user: PublicUser | null) => void
let sessionListener: SessionListener | null = null

export function onSessionChange(listener: SessionListener | null): void {
  sessionListener = listener
}

/* ------------------------------------------------------------ the request */

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
  /** Serialised as JSON, or sent as-is when it is already `FormData`. */
  body?: unknown
  query?: Record<string, string | number | boolean | undefined | null>
  signal?: AbortSignal
  /** Internal: prevents the refresh-and-retry loop from recursing. */
  skipAuthRetry?: boolean
}

function buildUrl(path: string, query: RequestOptions["query"]): string {
  const url = new URL(`${BASE_URL}${path}`)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

export async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, query, signal, skipAuthRetry } = options

  const isFormData = body instanceof FormData
  const headers: Record<string, string> = {}

  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  // Setting Content-Type on FormData would clobber the multipart boundary.
  if (body !== undefined && !isFormData) headers["Content-Type"] = "application/json"

  let response: Response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      // Carries the httpOnly refresh cookie on the auth routes.
      credentials: "include",
      ...(body !== undefined
        ? { body: isFormData ? body : JSON.stringify(body) }
        : {}),
      ...(signal ? { signal } : {}),
    })
  } catch (error) {
    // An abort is the caller's own doing, not a network failure.
    if (error instanceof DOMException && error.name === "AbortError") throw error
    throw new ApiError(
      "NETWORK_ERROR",
      "Could not reach the server. Check your connection and try again.",
      0
    )
  }

  // 204, and any other genuinely empty body.
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    if (response.ok) return undefined as T
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    if (response.ok) return undefined as T
    throw new ApiError(
      "INTERNAL_ERROR",
      "The server returned an unreadable response.",
      response.status
    )
  }

  const envelope = payload as
    | { success: true; data: T }
    | {
        success: false
        error: { code: ApiErrorCode; message: string; details?: ApiErrorDetail[] }
      }

  if (response.ok && envelope.success) {
    return envelope.data
  }

  const error = !envelope.success
    ? envelope.error
    : {
        code: "INTERNAL_ERROR" as ApiErrorCode,
        message: "Something went wrong.",
        details: [],
      }

  // An expired access token is recoverable: refresh once, then replay.
  const expired =
    response.status === 401 &&
    (error.code === "TOKEN_EXPIRED" || error.code === "UNAUTHENTICATED")

  if (expired && !skipAuthRetry) {
    const renewed = await refreshSession()
    if (renewed) {
      return request<T>(path, { ...options, skipAuthRetry: true })
    }
  }

  throw new ApiError(
    error.code,
    error.message,
    response.status,
    error.details ?? []
  )
}

/* ----------------------------------------------------------- the refresh */

let refreshInFlight: Promise<PublicUser | null> | null = null

/**
 * Exchanges the httpOnly refresh cookie for a new access token.
 *
 * Single-flight on purpose. Three widgets mounting at once all 401 at once;
 * without this they would each POST /auth/refresh, and since the server rotates
 * the refresh token on every use, the second and third would be rejected as
 * replays and sign the user out.
 */
export function refreshSession(): Promise<PublicUser | null> {
  refreshInFlight ??= (async () => {
    try {
      const data = await request<{ user: PublicUser; accessToken: string }>(
        "/auth/refresh",
        { method: "POST", skipAuthRetry: true }
      )
      accessToken = data.accessToken
      sessionListener?.(data.user)
      return data.user
    } catch {
      accessToken = null
      sessionListener?.(null)
      return null
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

/**
 * Restores a session on first paint. Skips the network entirely if a token is
 * already in hand, which is what makes React's StrictMode double-mount cheap.
 */
export function bootstrapSession(): Promise<PublicUser | null> {
  if (accessToken && !refreshInFlight) {
    return request<{ user: PublicUser }>("/auth/me")
      .then((data) => data.user)
      .catch(() => refreshSession())
  }
  return refreshSession()
}
