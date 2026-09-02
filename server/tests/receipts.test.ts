import { TxCategory, TxStatus, TxType } from "@prisma/client"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { toMoney } from "../src/lib/money.js"
import { credit } from "../src/services/ledger.service.js"
import { anon, as } from "./helpers/api.js"
import {
  cleanupTestUsers,
  createTestUser,
  hasDatabase,
  testPrisma,
} from "./helpers/db.js"

/**
 * Receipts are the one document that leaves the platform and is shown to
 * outsiders, so the properties worth proving are about what it discloses and
 * whether it can be trusted not to change.
 */
describe.skipIf(!hasDatabase)("receipts", () => {
  let admin: Awaited<ReturnType<typeof createTestUser>>
  let user: Awaited<ReturnType<typeof createTestUser>>
  let transactionId: string

  beforeAll(async () => {
    await cleanupTestUsers()
    admin = await createTestUser({ role: "ADMIN" })
    user = await createTestUser()

    const tx = await credit({
      userId: user.id,
      amount: toMoney(1014.75),
      category: TxCategory.DEPOSIT,
      description: "Bank transfer received and confirmed",
    })
    transactionId = tx.id
  })

  afterAll(async () => {
    await cleanupTestUsers()
    await testPrisma.$disconnect()
  })

  /* -------------------------------------------------------------- guards */

  it("refuses to issue a receipt for an unauthenticated caller", async () => {
    await anon("post", `/admin/transactions/${transactionId}/receipt`).expect(401)
  })

  it("refuses to issue a receipt for a non-admin", async () => {
    await as(user, "post", `/admin/transactions/${transactionId}/receipt`).expect(
      403
    )
  })

  /* ------------------------------------------------------------- issuing */

  it("issues a receipt with a reference and a link", async () => {
    const response = await as(
      admin,
      "post",
      `/admin/transactions/${transactionId}/receipt`
    ).expect(200)

    const receipt = response.body.data.receipt
    expect(receipt.reference).toMatch(/^SET-\d{4}-[A-Z2-9]{6}$/)
    expect(receipt.token.length).toBeGreaterThanOrEqual(20)
    expect(receipt.url).toContain(`/receipt/${receipt.token}`)
    expect(receipt.created).toBe(true)
  })

  /**
   * The property that matters most. A receipt already forwarded to a bank or an
   * accountant must not acquire a different number because someone clicked the
   * button again.
   */
  it("is idempotent — a second call returns the same reference and token", async () => {
    const first = await as(
      admin,
      "post",
      `/admin/transactions/${transactionId}/receipt`
    ).expect(200)

    const second = await as(
      admin,
      "post",
      `/admin/transactions/${transactionId}/receipt`
    ).expect(200)

    expect(second.body.data.receipt.reference).toBe(
      first.body.data.receipt.reference
    )
    expect(second.body.data.receipt.token).toBe(first.body.data.receipt.token)
    expect(second.body.data.receipt.created).toBe(false)
  })

  it("refuses a receipt for a transaction that has not completed", async () => {
    const pending = await testPrisma.transaction.create({
      data: {
        userId: user.id,
        type: TxType.DEBIT,
        category: TxCategory.WITHDRAWAL,
        amount: toMoney(50),
        status: TxStatus.PENDING,
      },
    })

    await as(admin, "post", `/admin/transactions/${pending.id}/receipt`).expect(
      400
    )
  })

  /* -------------------------------------------------------------- public */

  it("serves the receipt publicly to anyone holding the token", async () => {
    const issued = await as(
      admin,
      "post",
      `/admin/transactions/${transactionId}/receipt`
    ).expect(200)

    const token = issued.body.data.receipt.token as string
    const response = await anon("get", `/receipts/${token}`).expect(200)

    const receipt = response.body.data.receipt
    expect(receipt.amount).toBe("1014.75")
    expect(receipt.direction).toBe("CREDIT")
    expect(receipt.account.name).toBe(user.fullName)
    expect(receipt.account.uid).toBe(user.uid)
    expect(receipt.description).toBe("Bank transfer received and confirmed")
  })

  /**
   * The receipt is reachable by anyone with the link, so it must not become a
   * window onto the rest of the account.
   */
  it("does not disclose the account balance or any identifier beyond the uid", async () => {
    const issued = await as(
      admin,
      "post",
      `/admin/transactions/${transactionId}/receipt`
    ).expect(200)

    const response = await anon(
      "get",
      `/receipts/${issued.body.data.receipt.token}`
    ).expect(200)

    const body = JSON.stringify(response.body)
    expect(body).not.toContain("balance")
    expect(body).not.toContain("available")
    expect(body).not.toContain(user.email)
    expect(body).not.toContain(user.id)
  })

  it("404s on an unknown token rather than revealing whether one exists", async () => {
    await anon("get", `/receipts/${"z".repeat(32)}`).expect(404)
  })

  it("rejects a token too short to be real without touching the database", async () => {
    await anon("get", "/receipts/abc").expect(400)
  })
})
