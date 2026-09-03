import { DepositMethod, RequestStatus, TxCategory, TxStatus } from "@prisma/client"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { toMoney } from "../src/lib/money.js"
import { processDeposit } from "../src/modules/deposits/deposits.service.js"
import { cancelSubscription } from "../src/modules/plans/plans.service.js"
import { getBalanceSnapshot } from "../src/services/ledger.service.js"
import {
  cleanupTestUsers,
  createTestUser,
  hasDatabase,
  testPrisma,
} from "./helpers/db.js"

/**
 * Races against the money paths.
 *
 * Both bugs these cover had the same shape: a status check performed *outside*
 * the transaction that then does the writing. Read-check-write across that
 * boundary decides nothing — two callers both read the row, both pass the
 * check, and both proceed. Where the write is a `credit()`, which inserts a new
 * row rather than updating one, the customer is paid twice.
 *
 * A sequential test cannot see any of this. Every test here fires genuinely
 * concurrent calls and asserts on the resulting ledger rows, because the count
 * of credits is the only thing that actually proves the guard held.
 */
describe.skipIf(!hasDatabase)("concurrent money operations", () => {
  let admin: Awaited<ReturnType<typeof createTestUser>>

  beforeAll(async () => {
    await cleanupTestUsers()
    admin = await createTestUser({ role: "ADMIN" })
  })

  afterAll(async () => {
    await cleanupTestUsers()
    await testPrisma.plan.deleteMany({ where: { slug: { startsWith: "test-" } } })
    await testPrisma.$disconnect()
  })

  /* ----------------------------------------------------------- deposits */

  describe("approving a deposit twice at once", () => {
    it("credits the account exactly once", async () => {
      const user = await createTestUser()

      const request = await testPrisma.depositRequest.create({
        data: {
          userId: user.id,
          amount: toMoney(500),
          method: DepositMethod.BANK_TRANSFER,
          reference: "race-test",
          status: RequestStatus.PENDING,
        },
      })

      // Six at once: an impatient double-click, or two admins on the queue.
      const results = await Promise.allSettled(
        Array.from({ length: 6 }, () =>
          processDeposit({
            requestId: request.id,
            adminId: admin.id,
            action: "approve",
          })
        )
      )

      const credits = await testPrisma.transaction.findMany({
        where: { userId: user.id, category: TxCategory.DEPOSIT },
      })

      expect(credits).toHaveLength(1)
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1)

      const { balance } = await getBalanceSnapshot(user.id)
      expect(balance.toFixed(2)).toBe("500.00")
    })

    it("leaves the request approved and linked to that one transaction", async () => {
      const user = await createTestUser()
      const request = await testPrisma.depositRequest.create({
        data: {
          userId: user.id,
          amount: toMoney(120),
          method: DepositMethod.CRYPTO,
          reference: "race-test-2",
          status: RequestStatus.PENDING,
        },
      })

      await Promise.allSettled(
        Array.from({ length: 4 }, () =>
          processDeposit({
            requestId: request.id,
            adminId: admin.id,
            action: "approve",
          })
        )
      )

      const after = await testPrisma.depositRequest.findUniqueOrThrow({
        where: { id: request.id },
      })
      expect(after.status).toBe(RequestStatus.APPROVED)
      expect(after.transactionId).not.toBeNull()

      const linked = await testPrisma.transaction.findUniqueOrThrow({
        where: { id: after.transactionId! },
      })
      expect(linked.status).toBe(TxStatus.COMPLETED)
    })

    /** Approve and reject arriving together must not both take effect. */
    it("does not both credit and reject the same deposit", async () => {
      const user = await createTestUser()
      const request = await testPrisma.depositRequest.create({
        data: {
          userId: user.id,
          amount: toMoney(75),
          method: DepositMethod.BANK_TRANSFER,
          reference: "race-test-3",
          status: RequestStatus.PENDING,
        },
      })

      await Promise.allSettled([
        processDeposit({
          requestId: request.id,
          adminId: admin.id,
          action: "approve",
        }),
        processDeposit({
          requestId: request.id,
          adminId: admin.id,
          action: "reject",
        }),
      ])

      const after = await testPrisma.depositRequest.findUniqueOrThrow({
        where: { id: request.id },
      })
      const credits = await testPrisma.transaction.findMany({
        where: { userId: user.id, category: TxCategory.DEPOSIT },
      })

      // Whichever won, the ledger must agree with the recorded decision.
      if (after.status === RequestStatus.APPROVED) {
        expect(credits).toHaveLength(1)
      } else {
        expect(after.status).toBe(RequestStatus.REJECTED)
        expect(credits).toHaveLength(0)
      }
    })
  })

  /* ------------------------------------------------------ subscriptions */

  describe("cancelling a subscription twice at once", () => {
    it("returns the principal exactly once", async () => {
      const user = await createTestUser()

      const plan = await testPrisma.plan.create({
        data: {
          slug: `test-race-${Date.now()}`,
          name: "Race Plan",
          dailyReturnBps: 120,
          durationDays: 30,
          minDeposit: toMoney(10),
          maxDeposit: toMoney(10000),
          description: "Fixture for the cancellation race.",
          features: ["Race"],
        },
      })

      const subscription = await testPrisma.subscription.create({
        data: {
          userId: user.id,
          planId: plan.id,
          principal: toMoney(1000),
          status: "ACTIVE",
          startedAt: new Date(),
          endsAt: new Date(Date.now() + 30 * 86_400_000),
        },
      })

      // Reachable by any user with a double-tap — no admin needed.
      const results = await Promise.allSettled(
        Array.from({ length: 6 }, () =>
          cancelSubscription(user.id, subscription.id)
        )
      )

      const refunds = await testPrisma.transaction.findMany({
        where: { userId: user.id, category: TxCategory.PLAN_PRINCIPAL },
      })

      expect(refunds).toHaveLength(1)
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1)

      const { balance } = await getBalanceSnapshot(user.id)
      expect(balance.toFixed(2)).toBe("1000.00")

      const after = await testPrisma.subscription.findUniqueOrThrow({
        where: { id: subscription.id },
      })
      expect(after.status).toBe("CANCELLED")
    })
  })
})
