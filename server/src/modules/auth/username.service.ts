import {
  RESERVED_USERNAMES,
  USERNAME_SUGGESTION_COUNT,
} from "../../config/constants.js"
import { prisma } from "../../lib/prisma.js"
import { usernameSchema } from "./auth.schema.js"

/**
 * Username availability and suggestions.
 *
 * Until now the only way to learn a username was taken was to complete the
 * whole signup form and read a 409 — after choosing a password and accepting
 * the terms. The rules live here rather than in the route so that `register`
 * and the live check cannot drift: a name the check calls free must be one
 * `register` will actually accept.
 */

const MIN_LENGTH = 3
const MAX_LENGTH = 20

export type UnavailableReason = "taken" | "reserved" | "invalid"

export interface UsernameCheck {
  username: string
  available: boolean
  reason?: UnavailableReason
  message?: string
  suggestions: string[]
}

/** Case-insensitive: `Admin` impersonates just as well as `admin`. */
export function isReserved(username: string): boolean {
  return RESERVED_USERNAMES.includes(username.trim().toLowerCase())
}

/**
 * Strips a display name down to username-legal characters.
 *
 * Accented letters are folded rather than dropped, so "Zoë Müller" suggests
 * `zoe_muller` instead of `zo_mller`.
 */
function slugify(value: string): string {
  return value
    .normalize("NFKD")
    // Combining marks, written escaped — the literal range is invisible in a
    // diff and one stray byte turns it into a character class that eats Latin.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
}

function clamp(value: string): string {
  return value.slice(0, MAX_LENGTH).replace(/_+$/, "")
}

/**
 * Appends a suffix without exceeding the length cap — the base is trimmed to
 * make room, so `verylongusername` + `99` stays legal instead of being
 * silently rejected as a suggestion nobody could use.
 */
function withSuffix(base: string, suffix: string): string {
  const room = MAX_LENGTH - suffix.length
  return `${base.slice(0, Math.max(room, 1)).replace(/_+$/, "")}${suffix}`
}

function dedupe(values: string[]): string[] {
  const out: string[] = []
  for (const value of values) {
    const trimmed = clamp(value)
    if (trimmed.length >= MIN_LENGTH && !out.includes(trimmed)) out.push(trimmed)
  }
  return out
}

/** `joshua` → `joshua1`, `joshua_1`… Variants of what the user asked for. */
function variantsOf(desired: string): string[] {
  const base = clamp(slugify(desired)) || "user"
  const suffixed = ["1", "01", "_1", "7", "23", "99", "_x"].map((suffix) =>
    withSuffix(base, suffix)
  )

  // Deeper fallback so an unlucky input still yields something.
  for (let n = 2; n <= 30; n += 1) suffixed.push(withSuffix(base, String(n)))

  return dedupe(suffixed)
}

/** `Joshua Okoghie` → `joshua_okoghie`, `joshuaokoghie`, `j_okoghie`… */
function fromFullName(fullName: string | undefined): string[] {
  if (!fullName?.trim()) return []

  const parts = slugify(fullName).split("_").filter(Boolean)
  const [first = "", ...rest] = parts
  const last = rest.at(-1) ?? ""
  const out: string[] = []

  if (first && last) {
    out.push(`${first}_${last}`, `${first}${last}`, `${first.charAt(0)}_${last}`)
    out.push(`${first}_${last.charAt(0)}`, withSuffix(`${first}_${last}`, "1"))
  }
  if (first) {
    out.push(first, withSuffix(first, "1"), withSuffix(first, "_1"))
  }

  return dedupe(out)
}

/**
 * Candidate names, best first.
 *
 * Two rules shape the order:
 *
 *  - **Reserved names contribute nothing.** Blocking `admin` and then offering
 *    `admin1` hands back most of the impersonation the block just prevented,
 *    so for a reserved name the typed variants are dropped entirely and the
 *    suggestions come from the person's own name instead.
 *  - **Otherwise the two sources interleave.** Variants of the typed name led
 *    the list and filled every slot, so `joshua` taken produced `joshua1,
 *    joshua01, joshua_1, joshua7, joshua23` — five spellings of one idea, and
 *    the far better `joshua_okoghie` never surfaced.
 */
function candidates(desired: string, fullName?: string): string[] {
  const named = fromFullName(fullName)

  if (isReserved(desired)) {
    return dedupe([...named, ...variantsOf(desired)])
  }

  const variants = variantsOf(desired)
  const interleaved: string[] = []

  for (let i = 0; i < Math.max(named.length, variants.length); i += 1) {
    const variant = variants[i]
    const name = named[i]
    if (variant) interleaved.push(variant)
    if (name) interleaved.push(name)
  }

  return dedupe(interleaved)
}

/**
 * Filters candidates down to ones that are actually free.
 *
 * One `IN` query rather than a lookup per candidate — this runs on a debounced
 * keystroke, and forty round trips per character is how a helpful feature
 * becomes an outage.
 */
async function firstAvailable(
  pool: string[],
  limit: number
): Promise<string[]> {
  const legal = pool.filter(
    (name) => usernameSchema.safeParse(name).success && !isReserved(name)
  )
  if (legal.length === 0) return []

  // Raw, because Prisma's `mode: "insensitive"` is honoured for `equals` and
  // the `LIKE` operators but silently does nothing to an `in` list — Postgres
  // `IN` compares byte-for-byte, so `Joshua1` would have read as free while
  // `register` went on to reject it.
  const lowered = legal.map((name) => name.toLowerCase())
  const taken = await prisma.$queryRaw<Array<{ username: string }>>`
    SELECT username FROM users WHERE lower(username) = ANY(${lowered})
  `

  const used = new Set(taken.map((row) => row.username.toLowerCase()))
  return legal.filter((name) => !used.has(name.toLowerCase())).slice(0, limit)
}

export async function suggestUsernames(
  desired: string,
  fullName?: string,
  limit: number = USERNAME_SUGGESTION_COUNT
): Promise<string[]> {
  return firstAvailable(candidates(desired, fullName), limit)
}

/**
 * The answer the signup form renders under the field.
 *
 * Advisory only — someone can take the name between this call and the submit,
 * which is why `register` still checks and still returns a 409. This exists to
 * make that collision rare, not to make it impossible.
 */
export async function checkUsername(
  input: string,
  fullName?: string
): Promise<UsernameCheck> {
  const username = input.trim()

  const parsed = usernameSchema.safeParse(username)
  if (!parsed.success) {
    return {
      username,
      available: false,
      reason: "invalid",
      message: parsed.error.issues[0]?.message ?? "That username is not valid.",
      // Nothing sensible to suggest from an invalid string except what a name
      // gives us, and the caller may not have supplied one.
      suggestions: await suggestUsernames(username, fullName),
    }
  }

  if (isReserved(parsed.data)) {
    return {
      username: parsed.data,
      available: false,
      reason: "reserved",
      message: "That username is reserved. Please choose another.",
      suggestions: await suggestUsernames(parsed.data, fullName),
    }
  }

  // Case-insensitive so `Joshua` cannot be registered alongside `joshua` and
  // be mistaken for them — the column is unique, but only byte-for-byte.
  const existing = await prisma.user.findFirst({
    where: { username: { equals: parsed.data, mode: "insensitive" } },
    select: { id: true },
  })

  if (existing) {
    return {
      username: parsed.data,
      available: false,
      reason: "taken",
      message: "That username is already taken.",
      suggestions: await suggestUsernames(parsed.data, fullName),
    }
  }

  return { username: parsed.data, available: true, suggestions: [] }
}
