import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { anon } from "./helpers/api.js"
import {
  cleanupTestUsers,
  createTestUser,
  hasDatabase,
  testPrisma,
} from "./helpers/db.js"

/**
 * Username availability, suggestions, and the rules `register` must agree with.
 *
 * The whole feature is only worth having if the live answer and the submit
 * agree — a form that says "available" and then refuses on submit is worse
 * than one that never claimed to know.
 */
describe.skipIf(!hasDatabase)("username availability", () => {
  beforeAll(async () => {
    await cleanupTestUsers()
  })

  afterAll(async () => {
    await cleanupTestUsers()
    await testPrisma.$disconnect()
  })

  async function check(username: string, fullName?: string) {
    const response = await anon("post", "/auth/check-username")
      .send({ username, ...(fullName ? { fullName } : {}) })
      .expect(200)
    return response.body.data as {
      available: boolean
      reason?: string
      message?: string
      suggestions: string[]
    }
  }

  it("reports an unused username as available", async () => {
    const result = await check(`free_${Date.now()}`.slice(0, 20))
    expect(result.available).toBe(true)
    expect(result.suggestions).toEqual([])
  })

  it("reports a taken username with alternatives", async () => {
    const user = await createTestUser()

    const result = await check(user.username)
    expect(result.available).toBe(false)
    expect(result.reason).toBe("taken")
    expect(result.suggestions.length).toBeGreaterThan(0)
    expect(result.suggestions).not.toContain(user.username)
  })

  /** The unique index is byte-for-byte; the product treats them as one name. */
  it("treats a differently-cased username as taken", async () => {
    const user = await createTestUser()

    const result = await check(user.username.toUpperCase())
    expect(result.available).toBe(false)
    expect(result.reason).toBe("taken")
  })

  it("refuses reserved names in any casing", async () => {
    for (const name of ["admin", "Support", "STERLING", "security"]) {
      const result = await check(name)
      expect(result.available).toBe(false)
      expect(result.reason).toBe("reserved")
    }
  })

  it("explains why a malformed username is rejected", async () => {
    const result = await check("no spaces here")
    expect(result.available).toBe(false)
    expect(result.reason).toBe("invalid")
    expect(result.message).toMatch(/letters, numbers and underscores/i)
  })

  it("rejects a username that is too short", async () => {
    const result = await check("ab")
    expect(result.available).toBe(false)
    expect(result.reason).toBe("invalid")
  })

  /** Suggestions the form offers must themselves be registrable. */
  it("only suggests names that are free, legal and unreserved", async () => {
    const result = await check("admin", "Joshua Okoghie")
    expect(result.suggestions.length).toBeGreaterThan(0)

    for (const suggestion of result.suggestions) {
      expect(suggestion).toMatch(/^[a-zA-Z0-9_]{3,20}$/)
      const clash = await testPrisma.user.findFirst({
        where: { username: { equals: suggestion, mode: "insensitive" } },
      })
      expect(clash).toBeNull()
      expect(await check(suggestion)).toMatchObject({ available: true })
    }
  })

  it("uses the full name to suggest something human", async () => {
    const result = await check("admin", "Joshua Okoghie")
    expect(result.suggestions).toContain("joshua_okoghie")
  })

  it("folds accents rather than dropping the letters", async () => {
    const result = await check("admin", "Zoë Müller")
    expect(result.suggestions).toContain("zoe_muller")
  })

  it("keeps suggestions within the length cap for a long name", async () => {
    // Must be a name that is actually unavailable — an available one correctly
    // returns no suggestions at all.
    const result = await check("admin", "Bartholomew Fotheringay")
    expect(result.suggestions.length).toBeGreaterThan(0)
    for (const suggestion of result.suggestions) {
      expect(suggestion.length).toBeLessThanOrEqual(20)
    }
  })

  /* ------------------------------------------------ agreement with register */

  it("refuses to register a reserved username", async () => {
    await anon("post", "/auth/register")
      .send({
        fullName: "Reserved Tester",
        email: `reserved-${Date.now()}@example.test`,
        username: "support",
        country: "NG",
        phone: "0803 123 4567",
        password: "Password123!",
        acceptedTerms: true,
      })
      .expect(409)
  })

  it("refuses to register a username taken in another casing", async () => {
    const existing = await createTestUser()

    await anon("post", "/auth/register")
      .send({
        fullName: "Case Tester",
        email: `case-${Date.now()}@example.test`,
        username: existing.username.toUpperCase(),
        country: "NG",
        phone: "0803 123 4568",
        password: "Password123!",
        acceptedTerms: true,
      })
      .expect(409)
  })

  /* ---------------------------------------------------------------- login */

  /**
   * Only the email was folded, so someone who registered `Joshua_O` could sign
   * in with their address but never with their own username in lower case —
   * and the reply was the same "invalid credentials" an attacker gets.
   */
  it("signs in with a username in any casing, and tolerates stray spaces", async () => {
    const suffix = Date.now()
    const username = `MixedCase${suffix}`.slice(0, 20)

    await anon("post", "/auth/register")
      .send({
        fullName: "Mixed Case",
        email: `mixed-${suffix}@example.test`,
        username,
        country: "NG",
        phone: "0803 123 4569",
        password: "Password123!",
        acceptedTerms: true,
      })
      .expect(201)

    for (const identifier of [
      username,
      username.toLowerCase(),
      username.toUpperCase(),
      `  ${username}  `,
    ]) {
      await anon("post", "/auth/login")
        .send({ identifier, password: "Password123!" })
        .expect(200)
    }
  })
})
