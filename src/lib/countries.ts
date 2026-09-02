import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js"

/**
 * Every country the phone library knows, with its dialling code and a display
 * name — 245 of them, built at module load from data already in the bundle.
 *
 * No country-list package: `libphonenumber-js` ships the codes because it needs
 * them to parse, and `Intl.DisplayNames` is in every browser we support, so a
 * second dependency would only add weight and a second thing to keep in sync.
 */

export interface Country {
  /** ISO 3166-1 alpha-2, e.g. "NG". */
  code: CountryCode
  /** e.g. "Nigeria". */
  name: string
  /** Digits only, no plus, e.g. "234". */
  callingCode: string
  /** Regional-indicator pair — renders as the flag on every modern platform. */
  flag: string
}

/**
 * A → 🇦, B → 🇧… Two regional-indicator codepoints are drawn as one flag, so a
 * flag needs no image and no sprite sheet.
 */
function flagOf(code: string): string {
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((char) => 0x1f1a5 + char.charCodeAt(0))
  )
}

const displayNames = new Intl.DisplayNames(["en"], { type: "region" })

export const COUNTRIES: Country[] = getCountries()
  .map((code) => ({
    code,
    // Falls back to the raw code for the handful of territories Intl has no
    // name for, rather than rendering a blank row.
    name: displayNames.of(code) ?? code,
    callingCode: getCountryCallingCode(code),
    flag: flagOf(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

const BY_CODE = new Map(COUNTRIES.map((country) => [country.code, country]))

export function findCountry(code: string | undefined): Country | undefined {
  return code ? BY_CODE.get(code.toUpperCase() as CountryCode) : undefined
}

/**
 * Ranked search across name, ISO code and dialling code.
 *
 * A prefix match outranks a match in the middle, so typing "ind" puts India
 * above the British Indian Ocean Territory, and "+1" or "1" finds the countries
 * that actually dial with it.
 */
export function searchCountries(query: string): Country[] {
  const term = query.trim().toLowerCase().replace(/^\+/, "")
  if (!term) return COUNTRIES

  const scored: Array<{ country: Country; score: number }> = []

  for (const country of COUNTRIES) {
    const name = country.name.toLowerCase()
    const code = country.code.toLowerCase()

    let score = -1
    if (name.startsWith(term)) score = 0
    else if (code === term) score = 1
    else if (country.callingCode.startsWith(term) && /^\d+$/.test(term)) score = 2
    else if (name.includes(term)) score = 3

    if (score >= 0) scored.push({ country, score })
  }

  return scored
    .sort((a, b) => a.score - b.score || a.country.name.localeCompare(b.country.name))
    .map((entry) => entry.country)
}

/** The number as it should be stored and dialled, or null if it is not real. */
export function toE164(phone: string, country: string): string | null {
  const trimmed = phone.trim()
  if (!trimmed) return null

  const parsed = parsePhoneNumberFromString(trimmed, country as CountryCode)
  return parsed?.isValid() ? parsed.number : null
}

/** Groups digits the way the country writes them, as the user types. */
export function formatNational(phone: string, country: string): string {
  const parsed = parsePhoneNumberFromString(phone.trim(), country as CountryCode)
  return parsed?.isValid() ? parsed.formatNational() : phone
}

/**
 * A best guess at the visitor's country, used only to preselect the field.
 *
 * Read from the browser locale — `en-NG` implies Nigeria. Wrong for anyone
 * travelling or running an imported phone, which is why it is a default the
 * user can change rather than something inferred and hidden.
 */
export function guessCountry(): CountryCode {
  const candidates =
    typeof navigator === "undefined" ? [] : [...(navigator.languages ?? [])]

  for (const locale of candidates) {
    const region = locale.split("-")[1]?.toUpperCase()
    if (region && BY_CODE.has(region as CountryCode)) return region as CountryCode
  }

  return "US"
}
