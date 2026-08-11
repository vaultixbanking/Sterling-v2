/**
 * Display formatting for values that arrive from the API.
 *
 * Money is handled **as text**. The API serialises `Decimal(18,2)` to strings
 * like `"1234.56"`, and these helpers group and pad the digits without ever
 * constructing a JavaScript number — so a figure large enough to lose precision
 * as a double still renders exactly, and no rounding can creep in on the way to
 * the screen. Nothing here should ever be used for arithmetic; the server owns
 * every calculation.
 */

interface ParsedDecimal {
  negative: boolean
  whole: string
  fraction: string
}

function parseDecimal(value: string | null | undefined): ParsedDecimal {
  const raw = (value ?? "0").trim()
  const negative = raw.startsWith("-")
  const unsigned = negative ? raw.slice(1) : raw
  const [whole = "0", fraction = ""] = unsigned.split(".")
  return { negative, whole: whole || "0", fraction }
}

function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

export interface MoneyOptions {
  /** Prefix positive values with `+`. Useful for deltas. */
  showPlus?: boolean
  /** Drop the `$`. */
  bare?: boolean
}

/** `"1234.5"` → `"$1,234.50"` */
export function formatMoney(
  value: string | null | undefined,
  options: MoneyOptions = {}
): string {
  const { negative, whole, fraction } = parseDecimal(value)
  const cents = `${fraction}00`.slice(0, 2)
  const sign = negative ? "-" : options.showPlus && !isZero(value) ? "+" : ""
  return `${sign}${options.bare ? "" : "$"}${group(whole)}.${cents}`
}

/**
 * Compact form for tight spaces — `"$1.2M"`. Falls back to the full figure
 * below a thousand, where compacting only costs precision.
 */
export function formatMoneyCompact(value: string | null | undefined): string {
  const { negative, whole } = parseDecimal(value)
  const sign = negative ? "-" : ""
  const digits = whole.length

  if (digits <= 3) return formatMoney(value)

  const units: Array<[number, string]> = [
    [10, "B"],
    [7, "M"],
    [4, "K"],
  ]

  for (const [threshold, suffix] of units) {
    if (digits >= threshold) {
      const intLength = digits - (threshold - 1)
      const head = whole.slice(0, intLength)
      const tail = whole.slice(intLength, intLength + 1)
      return `${sign}$${group(head)}${tail === "0" ? "" : `.${tail}`}${suffix}`
    }
  }

  return formatMoney(value)
}

/** `-1` negative, `0` zero, `1` positive — without parsing to a number. */
export function moneySign(value: string | null | undefined): -1 | 0 | 1 {
  const { negative, whole, fraction } = parseDecimal(value)
  const allZero = /^0*$/.test(whole) && /^0*$/.test(fraction)
  if (allZero) return 0
  return negative ? -1 : 1
}

export function isZero(value: string | null | undefined): boolean {
  return moneySign(value) === 0
}

/** `"12.50"` → `"12.50%"`, sign optional. */
export function formatPercent(
  value: string | null | undefined,
  options: { showPlus?: boolean } = {}
): string {
  const { negative, whole, fraction } = parseDecimal(value)
  const decimals = `${fraction}00`.slice(0, 2)
  const sign = negative ? "-" : options.showPlus && !isZero(value) ? "+" : ""
  return `${sign}${group(whole)}.${decimals}%`
}

/**
 * Asset units, trailing zeros trimmed. Holdings are `Decimal(24,8)`, so a
 * half-bitcoin arrives as `"0.50000000"` and should read `0.5`.
 */
export function formatUnits(value: string | null | undefined): string {
  const raw = (value ?? "0").trim()
  if (!raw.includes(".")) return raw || "0"
  const trimmed = raw.replace(/0+$/, "").replace(/\.$/, "")
  return trimmed || "0"
}

/* ------------------------------------------------------------------ dates */

const DATE: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
}

const TIME: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", DATE)
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return `${date.toLocaleDateString("en-US", DATE)}, ${date.toLocaleTimeString("en-US", TIME)}`
}

/** `"3 days ago"`, for audit trails and activity feeds. */
export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["day", 86_400],
    ["hour", 3600],
    ["minute", 60],
  ]

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) {
      return formatter.format(Math.round(seconds / size), unit)
    }
  }
  return "just now"
}

/* ------------------------------------------------------------------ misc */

/** `"Ada Lovelace"` → `"AL"`, for avatar placeholders. */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  const first = parts[0]![0] ?? ""
  const last = parts.length > 1 ? (parts.at(-1)![0] ?? "") : ""
  return `${first}${last}`.toUpperCase()
}

/** `"BANK_TRANSFER"` → `"Bank transfer"`. */
export function humanise(value: string | null | undefined): string {
  if (!value) return "—"
  const words = value.replace(/_/g, " ").toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
