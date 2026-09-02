import { TxCategory, TxStatus, TxType } from "@prisma/client"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { toMoney } from "../src/lib/money.js"
import { credit, getBalanceSnapshot } from "../src/services/ledger.service.js"
import { anon, as } from "./helpers/api.js"
import {
  cleanupTestUsers,
  createTestUser,
  hasDatabase,
  testPrisma,
} from "./helpers/db.js"

/**
 * Route-level coverage for the admin surface.
 *
 * Everything here goes through the real Express app: the auth guard, the Zod
 * schema and the service. The unit suites already prove the ledger's
 * arithmetic — these prove the layer that decides what reaches it, which was
 * previously only ever tested by hand.
 */
describe.skipIf(!hasDatabase)("admin API", () => {
  let admin: Awaited<ReturnType<typeof createTestUser>>
  let user: Awaited<ReturnType<typeof createTestUser>>

  beforeAll(async () => {
    await cleanupTestUsers()
    admin = await createTestUser({ role: "ADMIN" })
    user = await createTestUser()
  })

  afterAll(async () => {
    // Users first. `Subscription.plan` is onDelete: Restrict, so a plan with a
    // book behind it cannot be dropped — but `Subscription.user` cascades, so
    // clearing the users clears the subscriptions and frees the plans.
    await cleanupTestUsers()
    await testPrisma.plan.deleteMany({ where: { slug: { startsWith: "test-" } } })
    await testPrisma.$disconnect()
  })

  /* ------------------------------------------------------------- guards */

  it("rejects an unauthenticated admin request", async () => {
    await anon("get", "/admin/stats").expect(401)
  })

  /**
   * The SwiftEdge regression, at the layer it actually mattered: its admin
   * routes were mounted behind the *user* middleware, so a customer's token
   * opened every one of them.
   */
  it("rejects a normal user holding a valid token", async () => {
    await as(user, "get", "/admin/stats").expect(403)
  })

  /* -------------------------------------------------------- adjustments */

  it("credits an account and moves the balance", async () => {
    const target = await createTestUser()

    const response = await as(admin, "post", `/admin/users/${target.uid}/adjustments`)
      .send({ direction: "credit", amount: 500, category: "DEPOSIT", notify: false })
      .expect(201)

    expect(response.body.data.balance).toBe("500.00")

    const snapshot = await getBalanceSnapshot(target.id)
    expect(snapshot.balance.toFixed(2)).toBe("500.00")
  })

  it("debits an account", async () => {
    const target = await createTestUser()
    await credit({
      userId: target.id,
      amount: toMoney(300),
      category: TxCategory.DEPOSIT,
    })

    await as(admin, "post", `/admin/users/${target.uid}/adjustments`)
      .send({ direction: "debit", amount: 120, category: "ADJUSTMENT" })
      .expect(201)

    expect((await getBalanceSnapshot(target.id)).balance.toFixed(2)).toBe("180.00")
  })

  /**
   * `WITHDRAWAL` and `PLAN_PRINCIPAL` belong to flows that pair every row with
   * a request or subscription record. Hand-writing one produced a transaction
   * the corresponding queue knew nothing about.
   */
  it("refuses a category outside the hand-writable set", async () => {
    await as(admin, "post", `/admin/users/${user.uid}/adjustments`)
      .send({ direction: "credit", amount: 10, category: "WITHDRAWAL" })
      .expect(400)

    await as(admin, "post", `/admin/users/${user.uid}/adjustments`)
      .send({ direction: "credit", amount: 10, category: "PLAN_PRINCIPAL" })
      .expect(400)
  })

  it("refuses a non-positive amount", async () => {
    await as(admin, "post", `/admin/users/${user.uid}/adjustments`)
      .send({ direction: "credit", amount: 0 })
      .expect(400)
  })

  it("refuses to debit more than the account holds", async () => {
    const target = await createTestUser()
    await as(admin, "post", `/admin/users/${target.uid}/adjustments`)
      .send({ direction: "debit", amount: 50 })
      .expect(422)
  })

  /* ------------------------------------------------------------ holdings */

  it("credits the balance when a holding is booked", async () => {
    const target = await createTestUser()

    await as(admin, "post", `/admin/users/${target.uid}/holdings`)
      .send({ name: "Bitcoin", symbol: "btc", units: 0.005, valueUsd: 300 })
      .expect(201)

    // Default is ON — the field was omitted entirely.
    expect((await getBalanceSnapshot(target.id)).balance.toFixed(2)).toBe("300.00")
  })

  it("records a position without crediting when asked", async () => {
    const target = await createTestUser()

    await as(admin, "post", `/admin/users/${target.uid}/holdings`)
      .send({
        name: "Ethereum",
        symbol: "eth",
        units: 1,
        valueUsd: 400,
        creditLedger: false,
      })
      .expect(201)

    expect((await getBalanceSnapshot(target.id)).balance.toFixed(2)).toBe("0.00")
  })

  it("reverses the credit when a holding is archived", async () => {
    const target = await createTestUser()

    const created = await as(admin, "post", `/admin/users/${target.uid}/holdings`)
      .send({ name: "Solana", symbol: "sol", units: 10, valueUsd: 250 })
      .expect(201)

    const holdingId = created.body.data.holding.id
    expect((await getBalanceSnapshot(target.id)).balance.toFixed(2)).toBe("250.00")

    const removed = await as(admin, "delete", `/admin/holdings/${holdingId}`).expect(200)
    expect(removed.body.data.reversed).toBe(true)

    // Balance back to zero, and invested capital with it — the reversal is a
    // DEBIT in the same category, which sumCategory nets.
    expect((await getBalanceSnapshot(target.id)).balance.toFixed(2)).toBe("0.00")
  })

  /**
   * `z.coerce.boolean()` would make this pass for the wrong reason: the string
   * "false" is truthy, so the opt-out would silently reverse anyway.
   */
  it("honours reverseLedger=false in the query string", async () => {
    const target = await createTestUser()

    const created = await as(admin, "post", `/admin/users/${target.uid}/holdings`)
      .send({ name: "Cardano", symbol: "ada", units: 100, valueUsd: 150 })
      .expect(201)

    const removed = await as(
      admin,
      "delete",
      `/admin/holdings/${created.body.data.holding.id}`
    )
      .query({ reverseLedger: "false" })
      .expect(200)

    expect(removed.body.data.reversed).toBe(false)
    expect((await getBalanceSnapshot(target.id)).balance.toFixed(2)).toBe("150.00")
  })

  it("refuses to archive the same holding twice", async () => {
    const target = await createTestUser()
    const created = await as(admin, "post", `/admin/users/${target.uid}/holdings`)
      .send({ name: "Polkadot", symbol: "dot", units: 5, valueUsd: 100 })
      .expect(201)

    const id = created.body.data.holding.id
    await as(admin, "delete", `/admin/holdings/${id}`).expect(200)
    // Without the archivedAt guard this would debit a second time.
    await as(admin, "delete", `/admin/holdings/${id}`).expect(400)
  })

  it("refuses to reverse a position whose money has been spent", async () => {
    const target = await createTestUser()
    const created = await as(admin, "post", `/admin/users/${target.uid}/holdings`)
      .send({ name: "Avalanche", symbol: "avax", units: 2, valueUsd: 200 })
      .expect(201)

    // Spend it.
    await as(admin, "post", `/admin/users/${target.uid}/adjustments`)
      .send({ direction: "debit", amount: 200 })
      .expect(201)

    await as(admin, "delete", `/admin/holdings/${created.body.data.holding.id}`)
      .expect(400)

    // The position survives the refusal — nothing half-applied.
    const holding = await testPrisma.holding.findUnique({
      where: { id: created.body.data.holding.id },
    })
    expect(holding?.archivedAt).toBeNull()
  })

  /* --------------------------------------------------------------- plans */

  it("creates, updates and retires a plan", async () => {
    const create = await as(admin, "post", "/admin/plans")
      .send({
        slug: "test-alpha",
        name: "Test Alpha",
        dailyReturnBps: 150,
        durationDays: 14,
        minDeposit: 100,
        maxDeposit: 5000,
        description: "A plan created by the integration suite.",
        features: ["One", "Two"],
      })
      .expect(201)

    const planId = create.body.data.plan.id
    expect(create.body.data.plan.dailyReturnPercent).toBe("1.50")

    const update = await as(admin, "patch", `/admin/plans/${planId}`)
      .send({ dailyReturnBps: 275 })
      .expect(200)
    expect(update.body.data.plan.dailyReturnPercent).toBe("2.75")

    // Nothing ever subscribed, so this is a real delete.
    const retire = await as(admin, "delete", `/admin/plans/${planId}`).expect(200)
    expect(retire.body.data.deleted).toBe(true)
    expect(await testPrisma.plan.findUnique({ where: { id: planId } })).toBeNull()
  })

  it("rejects a duplicate slug", async () => {
    await as(admin, "post", "/admin/plans")
      .send({
        slug: "test-dupe",
        name: "First",
        dailyReturnBps: 100,
        durationDays: 10,
        minDeposit: 50,
        description: "First.",
      })
      .expect(201)

    await as(admin, "post", "/admin/plans")
      .send({
        slug: "test-dupe",
        name: "Second",
        dailyReturnBps: 100,
        durationDays: 10,
        minDeposit: 50,
        description: "Second.",
      })
      // A slug clash is a conflict, not a malformed request — the payload was
      // perfectly well-formed, the world just already had one.
      .expect(409)
  })

  it("rejects a maximum deposit below the minimum", async () => {
    await as(admin, "post", "/admin/plans")
      .send({
        slug: "test-inverted",
        name: "Inverted",
        dailyReturnBps: 100,
        durationDays: 10,
        minDeposit: 1000,
        maxDeposit: 100,
        description: "Backwards.",
      })
      .expect(400)
  })

  it("rejects a malformed slug", async () => {
    await as(admin, "post", "/admin/plans")
      .send({
        slug: "Not A Slug",
        name: "Bad",
        dailyReturnBps: 100,
        durationDays: 10,
        minDeposit: 50,
        description: "Bad.",
      })
      .expect(400)
  })

  /**
   * A plan with a book behind it must survive, because the subscriptions
   * pointing at it are still being paid from its rate.
   */
  it("deactivates rather than deletes a plan that has subscriptions", async () => {
    const subscriber = await createTestUser()
    await credit({
      userId: subscriber.id,
      amount: toMoney(1000),
      category: TxCategory.DEPOSIT,
    })

    const create = await as(admin, "post", "/admin/plans")
      .send({
        slug: "test-subscribed",
        name: "Subscribed",
        dailyReturnBps: 100,
        durationDays: 10,
        minDeposit: 100,
        description: "Has a book.",
      })
      .expect(201)

    await as(subscriber, "post", "/subscriptions")
      .send({ planSlug: "test-subscribed", amount: 500 })
      .expect(201)

    const retire = await as(
      admin,
      "delete",
      `/admin/plans/${create.body.data.plan.id}`
    ).expect(200)

    expect(retire.body.data.deleted).toBe(false)

    const plan = await testPrisma.plan.findUnique({
      where: { id: create.body.data.plan.id },
    })
    expect(plan?.isActive).toBe(false)
  })

  it("hides an inactive plan from the public list but keeps it for admins", async () => {
    const publicList = await anon("get", "/plans").expect(200)
    const slugs = publicList.body.data.plans.map((plan: { slug: string }) => plan.slug)
    expect(slugs).not.toContain("test-subscribed")

    const adminList = await as(admin, "get", "/admin/plans").expect(200)
    const adminSlugs = adminList.body.data.plans.map(
      (plan: { slug: string }) => plan.slug
    )
    expect(adminSlugs).toContain("test-subscribed")
  })

  /* ------------------------------------------------------- subscriptions */

  it("cancels a subscription and returns the principal", async () => {
    const subscriber = await createTestUser()
    await credit({
      userId: subscriber.id,
      amount: toMoney(2000),
      category: TxCategory.DEPOSIT,
    })

    await as(admin, "post", "/admin/plans")
      .send({
        slug: "test-cancel",
        name: "Cancellable",
        dailyReturnBps: 100,
        durationDays: 10,
        minDeposit: 100,
        description: "For cancelling.",
      })
      .expect(201)

    const subscribed = await as(subscriber, "post", "/subscriptions")
      .send({ planSlug: "test-cancel", amount: 800 })
      .expect(201)

    // Principal is committed, not merely reserved.
    expect((await getBalanceSnapshot(subscriber.id)).balance.toFixed(2)).toBe(
      "1200.00"
    )

    await as(
      admin,
      "post",
      `/admin/subscriptions/${subscribed.body.data.subscription.id}/cancel`
    ).expect(200)

    expect((await getBalanceSnapshot(subscriber.id)).balance.toFixed(2)).toBe(
      "2000.00"
    )

    const rows = await testPrisma.transaction.findMany({
      where: { userId: subscriber.id, category: TxCategory.PLAN_PRINCIPAL },
    })
    expect(rows).toHaveLength(2)
    expect(rows.filter((row) => row.type === TxType.CREDIT)).toHaveLength(1)
    expect(rows.every((row) => row.status === TxStatus.COMPLETED)).toBe(true)
  })

  it("lists subscriptions for an admin and refuses a normal user", async () => {
    await as(admin, "get", "/admin/subscriptions").expect(200)
    await as(user, "get", "/admin/subscriptions").expect(403)
  })

  /* --------------------------------------------------------- user search */

  describe("user search", () => {
    /**
     * The UID search used to uppercase the term before an exact match. Every
     * account migrated from the old platform has a lowercase hex uid, so those
     * users — the entire existing customer base — could not be found by the one
     * identifier support is given over the phone.
     */
    it("finds a lowercase legacy-style uid", async () => {
      const legacy = await testPrisma.user.create({
        data: {
          uid: "3e1b9959",
          email: `legacy-${Date.now()}@example.test`,
          username: `legacy_${Date.now()}`.slice(0, 20),
          fullName: "Legacy Account",
          passwordHash: "x",
        },
      })

      const response = await as(admin, "get", "/admin/users")
        .query({ search: "3e1b9959" })
        .expect(200)

      expect(
        response.body.data.items.some(
          (row: { uid: string }) => row.uid === legacy.uid
        )
      ).toBe(true)
    })

    it("finds a uid whatever case the admin types", async () => {
      const response = await as(admin, "get", "/admin/users")
        .query({ search: "3E1B9959" })
        .expect(200)

      expect(
        response.body.data.items.some(
          (row: { uid: string }) => row.uid === "3e1b9959"
        )
      ).toBe(true)
    })

    /** Admins type the fragment they can see, not the whole reference. */
    it("matches on part of a uid", async () => {
      const response = await as(admin, "get", "/admin/users")
        .query({ search: "1b9959" })
        .expect(200)

      expect(
        response.body.data.items.some(
          (row: { uid: string }) => row.uid === "3e1b9959"
        )
      ).toBe(true)
    })
  })

})
