import { TxCategory, TxStatus } from "@prisma/client"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { toMoney } from "../src/lib/money.js"
import {
  credit,
  debit,
  getBalanceSnapshot,
  settle,
  unwind,
} from "../src/services/ledger.service.js"
import { cleanupTestUsers, createTestUser, hasDatabase, testPrisma } from "./helpers/db.js"

/**
 * Each test here pins down a specific defect in the SwiftEdge backend so it
 * cannot come back.
 */
describe.skipIf(!hasDatabase)("ledger", () => {
  beforeAll(async () => {
    await cleanupTestUsers()
  })

  afterAll(async () => {
    await cleanupTestUsers()
    await testPrisma.$disconnect()
  })

  it("derives balance from completed credits minus completed debits", async () => {
    const user = await createTestUser()

    await credit({
      userId: user.id,
      amount: toMoney(1000),
      category: TxCategory.DEPOSIT,
    })
    await credit({
      userId: user.id,
      amount: toMoney(250.5),
      category: TxCategory.PROFIT,
    })

    const snapshot = await getBalanceSnapshot(user.id)
    expect(snapshot.balance.toFixed(2)).toBe("1250.50")
    expect(snapshot.available.toFixed(2)).toBe("1250.50")
    expect(snapshot.reserved.toFixed(2)).toBe("0.00")
  })

  it("reserves pending debits so they cannot be spent twice", async () => {
    const user = await createTestUser()

    await credit({
      userId: user.id,
      amount: toMoney(1000),
      category: TxCategory.DEPOSIT,
    })

    await debit({
      userId: user.id,
      amount: toMoney(400),
      category: TxCategory.WITHDRAWAL,
    })

    const snapshot = await getBalanceSnapshot(user.id)
    // Settled balance is untouched until approval...
    expect(snapshot.balance.toFixed(2)).toBe("1000.00")
    // ...but the money is no longer spendable.
    expect(snapshot.reserved.toFixed(2)).toBe("400.00")
    expect(snapshot.available.toFixed(2)).toBe("600.00")
  })

  it("rejects a debit that exceeds the available balance", async () => {
    const user = await createTestUser()

    await credit({
      userId: user.id,
      amount: toMoney(500),
      category: TxCategory.DEPOSIT,
    })

    await expect(
      debit({
        userId: user.id,
        amount: toMoney(500.01),
        category: TxCategory.WITHDRAWAL,
      })
    ).rejects.toThrow(/insufficient/i)
  })

  /**
   * SwiftEdge bug: a user with $1,000 could submit ten $900 withdrawals
   * because each request checked the balance independently before writing.
   */
  it("allows only one of two concurrent withdrawals for 90% of the balance", async () => {
    const user = await createTestUser()

    await credit({
      userId: user.id,
      amount: toMoney(1000),
      category: TxCategory.DEPOSIT,
    })

    const attempt = () =>
      debit({
        userId: user.id,
        amount: toMoney(900),
        category: TxCategory.WITHDRAWAL,
      })

    const results = await Promise.allSettled([attempt(), attempt()])
    const fulfilled = results.filter((r) => r.status === "fulfilled")
    const rejected = results.filter((r) => r.status === "rejected")

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)

    const snapshot = await getBalanceSnapshot(user.id)
    expect(snapshot.available.toFixed(2)).toBe("100.00")
  })

  /**
   * THE bug. SwiftEdge stored `totalBalance` and recomputed it as
   * `holdings + profits` on every portfolio load, so an approved withdrawal
   * was silently refunded. Reading the balance repeatedly must never restore
   * withdrawn money.
   */
  it("keeps an approved withdrawal deducted across repeated reads", async () => {
    const user = await createTestUser()
    const admin = await createTestUser({ role: "ADMIN" })

    await credit({
      userId: user.id,
      amount: toMoney(1000),
      category: TxCategory.DEPOSIT,
    })

    const withdrawal = await debit({
      userId: user.id,
      amount: toMoney(300),
      category: TxCategory.WITHDRAWAL,
    })

    await settle(withdrawal.id, admin.id)

    const first = await getBalanceSnapshot(user.id)
    expect(first.balance.toFixed(2)).toBe("700.00")
    expect(first.reserved.toFixed(2)).toBe("0.00")

    // Read it several more times — the SwiftEdge failure mode surfaced on the
    // *next* request, not the one that approved the withdrawal.
    for (let i = 0; i < 3; i += 1) {
      const again = await getBalanceSnapshot(user.id)
      expect(again.balance.toFixed(2)).toBe("700.00")
      expect(again.available.toFixed(2)).toBe("700.00")
    }
  })

  it("releases the reservation when a withdrawal is rejected", async () => {
    const user = await createTestUser()
    const admin = await createTestUser({ role: "ADMIN" })

    await credit({
      userId: user.id,
      amount: toMoney(1000),
      category: TxCategory.DEPOSIT,
    })

    const withdrawal = await debit({
      userId: user.id,
      amount: toMoney(400),
      category: TxCategory.WITHDRAWAL,
    })

    expect((await getBalanceSnapshot(user.id)).available.toFixed(2)).toBe(
      "600.00"
    )

    await unwind(withdrawal.id, TxStatus.REJECTED, admin.id)

    const snapshot = await getBalanceSnapshot(user.id)
    expect(snapshot.balance.toFixed(2)).toBe("1000.00")
    expect(snapshot.available.toFixed(2)).toBe("1000.00")
    expect(snapshot.reserved.toFixed(2)).toBe("0.00")
  })

  it("keeps cent-level precision across many fractional entries", async () => {
    const user = await createTestUser()

    // 0.1 + 0.2 !== 0.3 in float arithmetic; Decimal must hold the line.
    for (let i = 0; i < 10; i += 1) {
      await credit({
        userId: user.id,
        amount: toMoney("0.10"),
        category: TxCategory.PROFIT,
      })
    }

    const snapshot = await getBalanceSnapshot(user.id)
    expect(snapshot.balance.toFixed(2)).toBe("1.00")
  })

  it("refuses a zero or negative amount", async () => {
    const user = await createTestUser()

    await expect(
      credit({
        userId: user.id,
        amount: toMoney(0),
        category: TxCategory.PROFIT,
      })
    ).rejects.toThrow()

    await expect(
      credit({
        userId: user.id,
        amount: toMoney(-5),
        category: TxCategory.PROFIT,
      })
    ).rejects.toThrow()
  })

  it("only settles a transaction once", async () => {
    const user = await createTestUser()
    const admin = await createTestUser({ role: "ADMIN" })

    await credit({
      userId: user.id,
      amount: toMoney(500),
      category: TxCategory.DEPOSIT,
    })
    const withdrawal = await debit({
      userId: user.id,
      amount: toMoney(100),
      category: TxCategory.WITHDRAWAL,
    })

    await settle(withdrawal.id, admin.id)
    await expect(settle(withdrawal.id, admin.id)).rejects.toThrow(/not found/i)
  })
})
