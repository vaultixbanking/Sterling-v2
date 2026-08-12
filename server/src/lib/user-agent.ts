/**
 * Minimal user-agent description, for login alerts.
 *
 * Deliberately coarse. The string is used two ways: shown to the user in an
 * email ("Chrome on macOS"), and compared against their previous sessions to
 * decide whether a sign-in is from somewhere new. Comparing raw UA strings
 * would flag a new device on every browser update — Chrome ships one roughly
 * every four weeks — and an alert that cries wolf gets filtered to spam.
 *
 * No dependency: a full UA database is a large, frequently-updated package for
 * output that only ever needs to read sensibly in one sentence.
 */

const BROWSERS: Array<[RegExp, string]> = [
  // Order matters — every one of these also contains "Safari" or "Chrome".
  [/\bEdg[A-Z]?\//, "Edge"],
  [/\bOPR\/|\bOpera\//, "Opera"],
  [/\bSamsungBrowser\//, "Samsung Internet"],
  [/\bFirefox\/|\bFxiOS\//, "Firefox"],
  [/\bCriOS\//, "Chrome"],
  [/\bChrome\//, "Chrome"],
  [/\bSafari\//, "Safari"],
]

const PLATFORMS: Array<[RegExp, string]> = [
  [/\biPhone\b/, "iPhone"],
  [/\biPad\b/, "iPad"],
  [/\bAndroid\b/, "Android"],
  [/\bWindows NT\b/, "Windows"],
  // "Mac OS X" also appears on iOS, so this must come after the iPhone/iPad checks.
  [/\bMac OS X\b|\bMacintosh\b/, "macOS"],
  [/\bCrOS\b/, "ChromeOS"],
  [/\bLinux\b/, "Linux"],
]

const firstMatch = (
  value: string,
  table: Array<[RegExp, string]>
): string | null => table.find(([pattern]) => pattern.test(value))?.[1] ?? null

/**
 * @returns Something like "Chrome on macOS", or null when the agent is absent
 *   or unrecognisable — the email template renders the row only when set, so
 *   an honest null beats an invented "Unknown device".
 */
export function describeDevice(userAgent: string | null | undefined): string | null {
  if (!userAgent?.trim()) return null

  const browser = firstMatch(userAgent, BROWSERS)
  const platform = firstMatch(userAgent, PLATFORMS)

  if (browser && platform) return `${browser} on ${platform}`
  return browser ?? platform
}
