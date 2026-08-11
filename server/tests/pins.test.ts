import { PinStatus } from "@prisma/client"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { consumePin, issuePin } from "../src/modules/pins/pins.service.js"
import { cleanupTestUsers, createTestUser, hasDatabase, testPrisma } from "./helpers/db.js"

/**
 * SwiftEdge's PINs were global, infinitely replayable, generated with
 * Math.random(), and never actually checked when withdrawing. Each test below
 * covers one of those holes.
 */
describe.skipIf(!hasDatabase)("withdrawal PINs", () => {
  beforeAll(async () => {
    await cleanupTestUsers()
  })

  afterAll(async () => {
    await cleanupTestUsers()
    await testPrisma.$disconnect()
  })

  it("accepts the correct PIN and consumes it", async () => {
    const user = await createTestUser()
    const admin = await createTestUser({ role: "ADMIN" })

    const issued = await issuePin({
      userId: user.id,
      issuedById: admin.id,
      length: 6,
      ttlMinutes: 30,
    })

    await testPrisma.$transaction(async (tx) => {
      await consumePin(tx, user.id, issued.pin)
    })

    const record = await testPrisma.withdrawalPin.findUniqueOrThrow({
      where: { id: issued.id },
    })
    expect(record.status).toBe(PinStatus.USED)
    expect(record.usedAt).not.toBeNull()
  })

  it("rejects a reused PIN", async () => {
    const user = await createTestUser()
    const admin = await createTestUser({ role: "ADMIN" })

    const issued = await issuePin({
      userId: user.id,
      issuedById: admin.id,
      length: 6,
      ttlMinutes: 30,
    })

    await testPrisma.$transaction((tx) => consumePin(tx, user.id, issued.pin))

    await expect(
      testPrisma.$transaction((tx) => consumePin(tx, user.id, issued.pin))
    ).rejects.toThrow(/invalid|expired|used/i)
  })

  /** The headline SwiftEdge flaw: PINs had no userId at all. */
  it("rejects another user's PIN", async () => {
    const owner = await createTestUser()
    const attacker = await createTestUser()
    const admin = await createTestUser({ role: "ADMIN" })

    const issued = await issuePin({
      userId: owner.id,
      issuedById: admin.id,
      length: 6,
      ttlMinutes: 30,
    })

    await expect(
      testPrisma.$transaction((tx) => consumePin(tx, attacker.id, issued.pin))
    ).rejects.toThrow(/invalid|expired|used/i)
  })

  it("rejects an expired PIN", async () => {
    const user = await createTestUser()
    const admin = await createTestUser({ role: "ADMIN" })

    const issued = await issuePin({
      userId: user.id,
      issuedById: admin.id,
      length: 4,
      ttlMinutes: 1,
    })

    await testPrisma.withdrawalPin.update({
      where: { id: issued.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    await expect(
      testPrisma.$transaction((tx) => consumePin(tx, user.id, issued.pin))
    ).rejects.toThrow(/invalid|expired|used/i)
  })

  it("rejects a wrong PIN", async () => {
    const user = await createTestUser()
    const admin = await createTestUser({ role: "ADMIN" })

    const issued = await issuePin({
      userId: user.id,
      issuedById: admin.id,
      length: 4,
      ttlMinutes: 30,
    })

    const wrong = issued.pin === "0000" ? "1111" : "0000"

    await expect(
      testPrisma.$transaction((tx) => consumePin(tx, user.id, wrong))
    ).rejects.toThrow(/invalid|expired|used/i)
  })

  it("supersedes the previous PIN when a new one is issued", async () => {
    const user = await createTestUser()
    const admin = await createTestUser({ role: "ADMIN" })

    const first = await issuePin({
      userId: user.id,
      issuedById: admin.id,
      length: 6,
      ttlMinutes: 30,
    })
    await issuePin({
      userId: user.id,
      issuedById: admin.id,
      length: 6,
      ttlMinutes: 30,
    })

    const stale = await testPrisma.withdrawalPin.findUniqueOrThrow({
      where: { id: first.id },
    })
    expect(stale.status).toBe(PinStatus.REVOKED)

    await expect(
      testPrisma.$transaction((tx) => consumePin(tx, user.id, first.pin))
    ).rejects.toThrow(/invalid|expired|used/i)
  })

  it("generates PINs of the requested length using digits only", async () => {
    const user = await createTestUser()
    const admin = await createTestUser({ role: "ADMIN" })

    for (const length of [4, 6] as const) {
      const issued = await issuePin({
        userId: user.id,
        issuedById: admin.id,
        length,
        ttlMinutes: 30,
      })
      expect(issued.pin).toMatch(new RegExp(`^\\d{${length}}$`))
    }
  })

  it("refuses an unsupported PIN length", async () => {
    const user = await createTestUser()
    const admin = await createTestUser({ role: "ADMIN" })

    await expect(
      issuePin({
        userId: user.id,
        issuedById: admin.id,
        length: 5,
        ttlMinutes: 30,
      })
    ).rejects.toThrow(/length/i)
  })
})
