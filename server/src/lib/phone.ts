import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js"

/**
 * Phone and country handling.
 *
 * The old rule was a single regex — `/^[+]?[\d\s()-]{7,20}$/` — which accepted
 * `(((((((` and `0000000`, and rejected nothing anyone would actually mistype.
 * A number that cannot be dialled is worse than no number when it is the only
 * way to reach someone about their money.
 *
 * Numbers are stored in **E.164** (`+2348031234567`): one canonical form, so
 * the same phone typed as `0803 123 4567` in Lagos and `+234 803 123 4567`
 * abroad is recognisably the same number rather than two rows that look
 * unrelated.
 */

const SUPPORTED = new Set<string>(getCountries())

export function isSupportedCountry(value: string): value is CountryCode {
  return SUPPORTED.has(value.toUpperCase())
}

export function callingCodeFor(country: CountryCode): string {
  return getCountryCallingCode(country)
}

/**
 * Normalises a typed number to E.164, or null if it is not a real number for
 * that country.
 *
 * The country is the parsing hint, not a constraint: someone living in the UK
 * may hold a Nigerian mobile, and a number already written with its own `+`
 * prefix is honoured as typed.
 */
export function toE164(phone: string, country: string): string | null {
  const trimmed = phone.trim()
  if (!trimmed) return null

  const upper = country.trim().toUpperCase()
  const parsed = isSupportedCountry(upper)
    ? parsePhoneNumberFromString(trimmed, upper)
    : parsePhoneNumberFromString(trimmed)

  return parsed?.isValid() ? parsed.number : null
}
