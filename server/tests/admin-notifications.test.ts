import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import type * as EmailService from "../src/services/email/email.service.js"
import { as } from "./helpers/api.js"
import {
  cleanupTestUsers,
  createTestUser,
  hasDatabase,
  testPrisma,
} from "./helpers/db.js"

/**
 * Auto-mock every sender so calls can be counted.
 *
 * `send()` already no-ops without a Resend key, so nothing would leave the
 * machine either way — but "no mail was sent" and "the code decided not to
 * send" are different facts, and only the second one is worth a test.
 */
vi.mock("../src/services/email/email.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof EmailService>()

  return Object.fromEntries(
    Object.entries(actual).map(([key, value]) => [
      key,
      typeof value === "function" ? vi.fn(async () => {}) : value,
    ])
  )
})

const mail = await import("../src/services/email/email.service.js")

/**
 * Who gets told what, and when.
 *
 * The rules are asymmetric on purpose, so they are worth pinning: money
 * arriving notifies by default, money leaving does not. Every one of these is
 * a decision someone could quietly invert with a one-character edit.
 */
describe.skipIf(!hasDatabase)("admin notifications", () => {
  let admin: Awaited<ReturnType<typeof createTestUser>>

  beforeAll(async () => {
    await cleanupTestUsers()
    admin = await createTestUser({ role: "ADMIN" })
  })

  afterAll(async () => {
    await cleanupTestUsers()
    await testPrisma.$disconnect()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  /* ------------------------------------------------------------- credits */

  it("emails on a credit by default", async () => {
    const target = await createTestUser()

    await as(admin, "post", `/admin/users/${target.uid}/adjustments`)
      .send({ direction: "credit", amount: 100 })
      .expect(201)

    expect(mail.sendAccountCreditedEmail).toHaveBeenCalledTimes(1)
  })

  it("stays silent on a credit when the admin opts out", async () => {
    const target = await createTestUser()

    await as(admin, "post", `/admin/users/${target.uid}/adjustments`)
      .send({ direction: "credit", amount: 100, notify: false })
      .expect(201)

    expect(mail.sendAccountCreditedEmail).not.toHaveBeenCalled()
    expect(mail.sendProfitCreditedEmail).not.toHaveBeenCalled()
  })

  it("sends the profit notice, not the generic one, for profit", async () => {
    const target = await createTestUser()

    await as(admin, "post", `/admin/users/${target.uid}/adjustments`)
      .send({ direction: "credit", amount: 100, category: "PROFIT" })
      .expect(201)

    expect(mail.sendProfitCreditedEmail).toHaveBeenCalledTimes(1)
    expect(mail.sendAccountCreditedEmail).not.toHaveBeenCalled()
  })

  it("treats a plan payout as profit for notification purposes", async () => {
    const target = await createTestUser()

    await as(admin, "post", `/admin/users/${target.uid}/adjustments`)
      .send({ direction: "credit", amount: 100, category: "PLAN_PAYOUT" })
      .expect(201)

    expect(mail.sendProfitCreditedEmail).toHaveBeenCalledTimes(1)
  })

  /* -------------------------------------------------------------- debits */

  /** The default the admin asked for: taking money back is silent unless said. */
  it("stays silent on a debit by default", async () => {
    const target = await createTestUser()
    await as(admin, "post", `/admin/users/${target.uid}/adjustments`)
      .send({ direction: "credit", amount: 500, notify: false })
      .expect(201)
    vi.clearAllMocks()

    await as(admin, "post", `/admin/users/${target.uid}/adjustments`)
      .send({ direction: "debit", amount: 200 })
      .expect(201)

    expect(mail.sendAccountDebitedEmail).not.toHaveBeenCalled()
  })

  it("emails on a debit when the admin ticks the box", async () => {
    const target = await createTestUser()
    await as(admin, "post", `/admin/users/${target.uid}/adjustments`)
      .send({ direction: "credit", amount: 500, notify: false })
      .expect(201)
    vi.clearAllMocks()

    await as(admin, "post", `/admin/users/${target.uid}/adjustments`)
      .send({ direction: "debit", amount: 200, notify: true })
      .expect(201)

    expect(mail.sendAccountDebitedEmail).toHaveBeenCalledTimes(1)
    // The user is told what is left, not just what went.
    expect(mail.sendAccountDebitedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ id: target.id }),
      "200.00",
      null,
      "300.00"
    )
  })

  /* ------------------------------------------------------------ holdings */

  it("emails when a holding is booked with a credit", async () => {
    const target = await createTestUser()

    await as(admin, "post", `/admin/users/${target.uid}/holdings`)
      .send({ name: "Bitcoin", symbol: "btc", units: 1, valueUsd: 300 })
      .expect(201)

    expect(mail.sendHoldingAddedEmail).toHaveBeenCalledTimes(1)
  })

  it("stays silent when a holding is booked without crediting", async () => {
    const target = await createTestUser()

    await as(admin, "post", `/admin/users/${target.uid}/holdings`)
      .send({
        name: "Bitcoin",
        symbol: "btc",
        units: 1,
        valueUsd: 300,
        creditLedger: false,
      })
      .expect(201)

    expect(mail.sendHoldingAddedEmail).not.toHaveBeenCalled()
  })

  it("stays silent when a holding reversal takes money back by default", async () => {
    const target = await createTestUser()
    const created = await as(admin, "post", `/admin/users/${target.uid}/holdings`)
      .send({ name: "Solana", symbol: "sol", units: 1, valueUsd: 250 })
      .expect(201)
    vi.clearAllMocks()

    await as(admin, "delete", `/admin/holdings/${created.body.data.holding.id}`)
      .expect(200)

    expect(mail.sendAccountDebitedEmail).not.toHaveBeenCalled()
  })

  it("emails on a holding reversal when asked", async () => {
    const target = await createTestUser()
    const created = await as(admin, "post", `/admin/users/${target.uid}/holdings`)
      .send({ name: "Solana", symbol: "sol", units: 1, valueUsd: 250 })
      .expect(201)
    vi.clearAllMocks()

    await as(admin, "delete", `/admin/holdings/${created.body.data.holding.id}`)
      .query({ notify: "true" })
      .expect(200)

    expect(mail.sendAccountDebitedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ id: target.id }),
      "250.00",
      "Solana position removed",
      "0.00"
    )
  })

  /**
   * No money moved, so there is nothing to announce — asking to be notified
   * about a reversal that did not happen must not produce a mail claiming it
   * did.
   */
  it("sends nothing when notify is asked for but nothing was reversed", async () => {
    const target = await createTestUser()
    const created = await as(admin, "post", `/admin/users/${target.uid}/holdings`)
      .send({
        name: "Cardano",
        symbol: "ada",
        units: 1,
        valueUsd: 100,
        creditLedger: false,
      })
      .expect(201)
    vi.clearAllMocks()

    await as(admin, "delete", `/admin/holdings/${created.body.data.holding.id}`)
      .query({ notify: "true" })
      .expect(200)

    expect(mail.sendAccountDebitedEmail).not.toHaveBeenCalled()
  })

  /* ------------------------------------------------- withdrawal PIN email */

  describe("withdrawal PIN", () => {
    it("does not email the PIN unless the admin asks", async () => {
      const user = await createTestUser()

      await as(admin, "post", `/admin/users/${user.uid}/pins`)
        .send({ length: 6, ttlMinutes: 60, notifyUser: false })
        .expect(201)

      expect(mail.sendWithdrawalPinEmail).not.toHaveBeenCalled()
    })

    /**
     * The PIN has to reach the send call. An email announcing that a PIN exists
     * without carrying it is the behaviour this replaced, and it would look
     * identical to a passing test that only counted calls.
     */
    it("emails the PIN itself when asked, and it matches the one issued", async () => {
      const user = await createTestUser()

      const response = await as(admin, "post", `/admin/users/${user.uid}/pins`)
        .send({ length: 6, ttlMinutes: 60, notifyUser: true })
        .expect(201)

      const issuedPin = response.body.data.pin as string
      expect(issuedPin).toMatch(/^\d{6}$/)

      expect(mail.sendWithdrawalPinEmail).toHaveBeenCalledTimes(1)
      const [recipient, pin, ttl] = vi.mocked(mail.sendWithdrawalPinEmail).mock
        .calls[0]!
      expect(recipient.email).toBe(user.email)
      expect(pin).toBe(issuedPin)
      expect(ttl).toBe(60)
    })
  })

})
