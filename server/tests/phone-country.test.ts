import { describe, expect, it } from "vitest"

import { isSupportedCountry, toE164 } from "../src/lib/phone.js"
import { registerSchema } from "../src/modules/auth/auth.schema.js"

/**
 * Phone and country at the boundary.
 *
 * The rule this replaces was `/^[+]?[\d\s()-]{7,20}$/`, which accepted
 * "(((((((" and "0000000" — so these cases are the point of the change, not
 * edge cases around it.
 */
describe("phone normalisation", () => {
  it("normalises a national number to E.164 using the country", () => {
    expect(toE164("0803 123 4567", "NG")).toBe("+2348031234567")
    expect(toE164("(415) 555-2671", "US")).toBe("+14155552671")
  })

  it("honours a number already written with its own country code", () => {
    expect(toE164("+2348031234567", "US")).toBe("+2348031234567")
  })

  it("rejects what the old regex accepted", () => {
    expect(toE164("(((((((", "US")).toBeNull()
    expect(toE164("0000000", "US")).toBeNull()
    expect(toE164("123", "US")).toBeNull()
    expect(toE164("", "NG")).toBeNull()
  })

  it("rejects a number that is not valid for the country given", () => {
    // A valid UK mobile, declared as American.
    expect(toE164("07911 123456", "US")).toBeNull()
  })

  it("knows which countries exist", () => {
    expect(isSupportedCountry("NG")).toBe(true)
    expect(isSupportedCountry("gb")).toBe(true)
    expect(isSupportedCountry("ZZ")).toBe(false)
  })
})

describe("registerSchema", () => {
  const base = {
    fullName: "Joshua Okoghie",
    email: "joshua@example.test",
    username: "joshua_o",
    country: "NG",
    phone: "0803 123 4567",
    password: "Password123!",
    acceptedTerms: true as const,
  }

  it("accepts a valid signup and stores the phone in E.164", () => {
    const result = registerSchema.safeParse(base)
    expect(result.success).toBe(true)
    expect(result.data?.phone).toBe("+2348031234567")
    expect(result.data?.country).toBe("NG")
  })

  it("uppercases a lowercase country code", () => {
    const result = registerSchema.safeParse({ ...base, country: "ng" })
    expect(result.success).toBe(true)
    expect(result.data?.country).toBe("NG")
  })

  /** Phone used to be optional; it is the whole point of this change. */
  it("refuses a missing phone number", () => {
    const result = registerSchema.safeParse({ ...base, phone: "" })
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.path.includes("phone"))).toBe(true)
  })

  it("refuses a number that is not valid for the selected country", () => {
    const result = registerSchema.safeParse({ ...base, country: "US" })
    expect(result.success).toBe(false)
    // Attached to the field, so the form can mark the input rather than the page.
    expect(result.error?.issues.some((i) => i.path.includes("phone"))).toBe(true)
  })

  it("refuses an unknown country", () => {
    const result = registerSchema.safeParse({ ...base, country: "ZZ" })
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.path.includes("country"))).toBe(true)
  })

  it("refuses a missing country", () => {
    const { country: _omitted, ...without } = base
    expect(registerSchema.safeParse(without).success).toBe(false)
  })
})
