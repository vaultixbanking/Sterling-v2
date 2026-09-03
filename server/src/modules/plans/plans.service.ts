import {
  Prisma,
  SubscriptionStatus,
  TxCategory,
  type Plan,
  type Subscription,
  type User,
} from "@prisma/client"

import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../lib/errors.js"
import { logger } from "../../lib/logger.js"
import { ZERO, bpsOf, round2, serialize, toMoney, type Money } from "../../lib/money.js"
import type { Pagination } from "../../lib/pagination.js"
import { toSkipTake } from "../../lib/pagination.js"
import { prisma } from "../../lib/prisma.js"
import { recordAudit } from "../../services/audit.service.js"
import {
  sendSubscriptionCancelledEmail,
  sendSubscriptionCompletedEmail,
  sendSubscriptionConfirmedEmail,
} from "../../services/email/email.service.js"
import { credit, debit, getBalanceSnapshot } from "../../services/ledger.service.js"

/**
 * Investment plans and subscriptions.
 *
 * Entirely new — SwiftEdge had no plan model anywhere despite the concept
 * being central to how the business is sold. Plan figures are seeded from the
 * same numbers the marketing page uses.
 */

export function serializePlan(plan: Plan) {
  return {
    id: plan.id,
    slug: plan.slug,
    name: plan.name,
    /** e.g. "1.20" — percent per day. */
    dailyReturnPercent: (plan.dailyReturnBps / 100).toFixed(2),
    durationDays: plan.durationDays,
    minDeposit: serialize(plan.minDeposit),
    maxDeposit: plan.maxDeposit ? serialize(plan.maxDeposit) : null,
    referralBonusPercent: plan.referralBonusPercent,
    description: plan.description,
    features: plan.features,
    isPopular: plan.isPopular,
  }
}

export async function listPlans() {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  })
  return plans.map(serializePlan)
}

export function serializeSubscription(
  subscription: Subscription & { plan: Plan }
) {
  return {
    id: subscription.id,
    plan: serializePlan(subscription.plan),
    principal: serialize(subscription.principal),
    totalAccrued: serialize(subscription.totalAccrued),
    status: subscription.status,
    startedAt: subscription.startedAt,
    endsAt: subscription.endsAt,
  }
}

export async function listSubscriptions(userId: string) {
  const subscriptions = await prisma.subscription.findMany({
    where: { userId },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  })
  return subscriptions.map(serializeSubscription)
}

/**
 * Subscribing moves capital out of the spendable balance and into the plan.
 * The principal is returned as a credit when the term completes.
 */
export async function subscribe(
  userId: string,
  planSlug: string,
  amountInput: number
): Promise<Subscription & { plan: Plan }> {
  const plan = await prisma.plan.findUnique({ where: { slug: planSlug } })
  if (!plan || !plan.isActive) throw new NotFoundError("Plan")

  const principal = round2(toMoney(amountInput))

  if (principal.lessThan(plan.minDeposit)) {
    throw new ValidationError(
      `The ${plan.name} plan requires at least $${serialize(plan.minDeposit)}.`
    )
  }
  if (plan.maxDeposit && principal.greaterThan(plan.maxDeposit)) {
    throw new ValidationError(
      `The ${plan.name} plan accepts at most $${serialize(plan.maxDeposit)}.`
    )
  }

  const endsAt = new Date()
  endsAt.setUTCDate(endsAt.getUTCDate() + plan.durationDays)

  const subscription = await prisma.$transaction(
    async (tx) => {
      // Settles immediately — the capital is committed, not merely reserved.
      await debit(
        {
          userId,
          amount: principal,
          category: TxCategory.PLAN_PRINCIPAL,
          description: `${plan.name} plan subscription`,
          metadata: { planSlug: plan.slug },
          status: "COMPLETED",
        },
        tx
      )

      return tx.subscription.create({
        data: {
          userId,
          planId: plan.id,
          principal,
          endsAt,
        },
        include: { plan: true },
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
  )

  // Committing capital is the single largest thing a user does here. Confirm it
  // outside the transaction so a mail failure cannot roll back a settled debit.
  void notifySubscriber(userId, async (user) => {
    const { balance } = await getBalanceSnapshot(userId)

    return sendSubscriptionConfirmedEmail(user, {
      planName: plan.name,
      principal: serialize(principal),
      dailyReturnPercent: (plan.dailyReturnBps / 100).toFixed(2),
      durationDays: plan.durationDays,
      endsAt,
      newBalance: serialize(balance),
    })
  })

  return subscription
}

/**
 * Look the user up and send, swallowing failures.
 *
 * Every plan email is a courtesy on top of a ledger entry that has already
 * settled — none of them may propagate, and none may be awaited by the caller.
 */
function notifySubscriber(
  userId: string,
  send: (user: User) => Promise<void>
): Promise<void> {
  return prisma.user
    .findUnique({ where: { id: userId } })
    .then((user) => (user ? send(user) : undefined))
    .catch((error: unknown) => {
      logger.error({ err: error, userId }, "Plan email failed")
    })
}

export async function cancelSubscription(
  userId: string,
  subscriptionId: string
): Promise<void> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  })

  if (!subscription || subscription.userId !== userId) {
    throw new NotFoundError("Subscription")
  }
  if (subscription.status !== SubscriptionStatus.ACTIVE) {
    throw new ValidationError("That subscription is no longer active.")
  }

  await prisma.$transaction(async (tx) => {
    /*
     * Cancel first, refund second — and cancel conditionally.
     *
     * The ACTIVE check above happens outside this transaction, so two taps on
     * Cancel both passed it and both reached `credit()`, which creates a new
     * row per call. The principal came back twice. This one was reachable by
     * any user with a double-tap, not just an admin.
     *
     * Ordering matters as much as the condition: claiming the subscription
     * before crediting means the caller who loses the race has already failed
     * by the time any money would move. Same compare-and-swap as `settle` and
     * `unwind`; `accrueDailyReturns` below guards itself the same way via
     * `lastAccruedOn`.
     */
    const claimed = await tx.subscription.updateMany({
      where: { id: subscription.id, status: SubscriptionStatus.ACTIVE },
      data: { status: SubscriptionStatus.CANCELLED },
    })

    if (claimed.count !== 1) {
      throw new ValidationError("That subscription is no longer active.")
    }

    // Early exit returns the principal; accrued payouts already credited stay.
    await credit(
      {
        userId,
        amount: subscription.principal,
        category: TxCategory.PLAN_PRINCIPAL,
        description: `${subscription.plan.name} plan cancelled — principal returned`,
        metadata: { subscriptionId: subscription.id },
      },
      tx
    )
  })

  void notifySubscriber(userId, async (user) => {
    const { balance } = await getBalanceSnapshot(userId)

    return sendSubscriptionCancelledEmail(user, {
      planName: subscription.plan.name,
      principal: serialize(subscription.principal),
      newBalance: serialize(balance),
    })
  })
}

/**
 * Daily accrual, idempotent via `lastAccruedOn`: re-running on the same UTC
 * day is a no-op, so a restarted or duplicated job cannot double-pay.
 */
export async function accrueDailyReturns(): Promise<{
  processed: number
  credited: string
}> {
  const now = new Date()
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )

  const due = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
      OR: [{ lastAccruedOn: null }, { lastAccruedOn: { lt: today } }],
    },
    include: { plan: true },
  })

  let processed = 0
  let credited = ZERO

  for (const subscription of due) {
    const payout = bpsOf(subscription.principal, subscription.plan.dailyReturnBps)
    const matured = subscription.endsAt <= now

    try {
      await prisma.$transaction(async (tx) => {
        // Guard inside the transaction so two workers cannot both pay out.
        const claimed = await tx.subscription.updateMany({
          where: {
            id: subscription.id,
            status: SubscriptionStatus.ACTIVE,
            OR: [{ lastAccruedOn: null }, { lastAccruedOn: { lt: today } }],
          },
          data: {
            lastAccruedOn: today,
            totalAccrued: { increment: payout },
            ...(matured ? { status: SubscriptionStatus.COMPLETED } : {}),
          },
        })

        if (claimed.count === 0) return

        await credit(
          {
            userId: subscription.userId,
            amount: payout,
            category: TxCategory.PLAN_PAYOUT,
            description: `${subscription.plan.name} plan daily return`,
            metadata: { subscriptionId: subscription.id },
          },
          tx
        )

        if (matured) {
          await credit(
            {
              userId: subscription.userId,
              amount: subscription.principal,
              category: TxCategory.PLAN_PRINCIPAL,
              description: `${subscription.plan.name} plan matured — principal returned`,
              metadata: { subscriptionId: subscription.id },
            },
            tx
          )
        }

        processed += 1
        credited = credited.add(payout)
      })

      if (matured) {
        void notifySubscriber(subscription.userId, async (user) => {
          const { balance } = await getBalanceSnapshot(subscription.userId)

          return sendSubscriptionCompletedEmail(user, {
            planName: subscription.plan.name,
            principal: serialize(subscription.principal),
            // `totalAccrued` is the pre-run figure; today's payout is the last.
            totalEarned: serialize(subscription.totalAccrued.add(payout)),
            newBalance: serialize(balance),
          })
        })
      }
    } catch (error) {
      // One bad subscription must not stop the rest of the run.
      logger.error(
        { err: error, subscriptionId: subscription.id },
        "Plan accrual failed"
      )
    }
  }

  return { processed, credited: serialize(credited) }
}

export async function getAvailableForSubscription(
  userId: string
): Promise<string> {
  const { available } = await getBalanceSnapshot(userId)
  return serialize(available)
}

/* ------------------------------------------------------------------ admin */

/**
 * Plan administration.
 *
 * Plans were seeded once and only changeable with a psql session against
 * production — so altering a headline rate, or retiring a tier, meant hand-
 * editing the table the accrual job reads every night.
 *
 * Two rules the write paths enforce:
 *
 *  - A plan with subscriptions is never deleted, only deactivated. Postgres
 *    would refuse the delete anyway (`onDelete: Restrict`), but failing with a
 *    foreign-key error rather than an explanation is not an answer.
 *  - `dailyReturnBps` and `durationDays` are edited freely, but the change
 *    applies to *future* accruals only. Live subscriptions carry their own
 *    `principal` and are paid from the plan they are attached to, so a rate cut
 *    reprices existing books from tonight's run onward. That is surfaced in the
 *    UI rather than hidden.
 */

/** Everything, including retired tiers — the admin list must show both. */
export async function adminListPlans() {
  const plans = await prisma.plan.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      _count: { select: { subscriptions: true } },
    },
  })

  const active = await prisma.subscription.groupBy({
    by: ["planId"],
    where: { status: SubscriptionStatus.ACTIVE },
    _count: { _all: true },
    _sum: { principal: true },
  })

  return plans.map((plan) => {
    const live = active.find((row) => row.planId === plan.id)

    return {
      ...serializePlan(plan),
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
      subscriptions: {
        total: plan._count.subscriptions,
        active: live?._count._all ?? 0,
        activePrincipal: serialize(live?._sum.principal ?? ZERO),
      },
    }
  })
}

export interface PlanInput {
  slug: string
  name: string
  dailyReturnBps: number
  durationDays: number
  minDeposit: number
  maxDeposit?: number | null | undefined
  referralBonusPercent: number
  description: string
  features: string[]
  isPopular: boolean
  isActive: boolean
  sortOrder: number
}

/** Shared by create and update — the invariants hold in both directions. */
function assertPlanShape(input: {
  minDeposit: Money
  maxDeposit: Money | null
}): void {
  if (input.maxDeposit && input.maxDeposit.lessThan(input.minDeposit)) {
    throw new ValidationError(
      "The maximum deposit cannot be below the minimum deposit."
    )
  }
}

export async function createPlan(params: {
  input: PlanInput
  adminId: string
  ip?: string | undefined
}) {
  const { input } = params

  const minDeposit = round2(toMoney(input.minDeposit))
  const maxDeposit =
    input.maxDeposit === null || input.maxDeposit === undefined
      ? null
      : round2(toMoney(input.maxDeposit))

  assertPlanShape({ minDeposit, maxDeposit })

  const existing = await prisma.plan.findUnique({ where: { slug: input.slug } })
  if (existing) {
    throw new ConflictError(`A plan with the slug "${input.slug}" already exists.`)
  }

  const plan = await prisma.plan.create({
    data: {
      slug: input.slug,
      name: input.name,
      dailyReturnBps: input.dailyReturnBps,
      durationDays: input.durationDays,
      minDeposit,
      maxDeposit,
      referralBonusPercent: input.referralBonusPercent,
      description: input.description,
      features: input.features,
      isPopular: input.isPopular,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    },
  })

  await recordAudit({
    actorId: params.adminId,
    action: "plan.create",
    targetType: "Plan",
    targetId: plan.id,
    after: { slug: plan.slug, name: plan.name, dailyReturnBps: plan.dailyReturnBps },
    ip: params.ip,
  })

  return serializePlan(plan)
}

export async function updatePlan(params: {
  planId: string
  input: Partial<PlanInput>
  adminId: string
  ip?: string | undefined
}) {
  const existing = await prisma.plan.findUnique({ where: { id: params.planId } })
  if (!existing) throw new NotFoundError("Plan")

  const { input } = params

  const minDeposit =
    input.minDeposit === undefined
      ? existing.minDeposit
      : round2(toMoney(input.minDeposit))

  const maxDeposit =
    input.maxDeposit === undefined
      ? existing.maxDeposit
      : input.maxDeposit === null
        ? null
        : round2(toMoney(input.maxDeposit))

  assertPlanShape({ minDeposit, maxDeposit })

  // The slug is the public identifier a subscription is created against, so a
  // collision has to be caught before the unique index turns it into a 500.
  if (input.slug && input.slug !== existing.slug) {
    const clash = await prisma.plan.findUnique({ where: { slug: input.slug } })
    if (clash) {
      throw new ConflictError(`A plan with the slug "${input.slug}" already exists.`)
    }
  }

  const plan = await prisma.plan.update({
    where: { id: params.planId },
    data: {
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.dailyReturnBps !== undefined
        ? { dailyReturnBps: input.dailyReturnBps }
        : {}),
      ...(input.durationDays !== undefined
        ? { durationDays: input.durationDays }
        : {}),
      ...(input.minDeposit !== undefined ? { minDeposit } : {}),
      ...(input.maxDeposit !== undefined ? { maxDeposit } : {}),
      ...(input.referralBonusPercent !== undefined
        ? { referralBonusPercent: input.referralBonusPercent }
        : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.features !== undefined ? { features: input.features } : {}),
      ...(input.isPopular !== undefined ? { isPopular: input.isPopular } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  })

  await recordAudit({
    actorId: params.adminId,
    action: "plan.update",
    targetType: "Plan",
    targetId: plan.id,
    before: {
      slug: existing.slug,
      dailyReturnBps: existing.dailyReturnBps,
      durationDays: existing.durationDays,
      minDeposit: serialize(existing.minDeposit),
      isActive: existing.isActive,
    },
    after: {
      slug: plan.slug,
      dailyReturnBps: plan.dailyReturnBps,
      durationDays: plan.durationDays,
      minDeposit: serialize(plan.minDeposit),
      isActive: plan.isActive,
    },
    ip: params.ip,
  })

  return serializePlan(plan)
}

/**
 * Retires a plan. Deletes it outright only if nothing was ever subscribed —
 * otherwise it is deactivated, because the subscriptions that reference it are
 * still being paid and still need its rate.
 */
export async function retirePlan(params: {
  planId: string
  adminId: string
  ip?: string | undefined
}): Promise<{ deleted: boolean }> {
  const plan = await prisma.plan.findUnique({
    where: { id: params.planId },
    include: { _count: { select: { subscriptions: true } } },
  })
  if (!plan) throw new NotFoundError("Plan")

  const deletable = plan._count.subscriptions === 0

  if (deletable) {
    await prisma.plan.delete({ where: { id: plan.id } })
  } else {
    await prisma.plan.update({
      where: { id: plan.id },
      data: { isActive: false },
    })
  }

  await recordAudit({
    actorId: params.adminId,
    action: deletable ? "plan.delete" : "plan.deactivate",
    targetType: "Plan",
    targetId: plan.id,
    before: { slug: plan.slug, isActive: plan.isActive },
    after: { deleted: deletable, subscriptions: plan._count.subscriptions },
    ip: params.ip,
  })

  return { deleted: deletable }
}

/** Every subscription on the platform, newest first. */
export async function adminListSubscriptions(params: {
  pagination: Pagination
  status?: SubscriptionStatus | undefined
}) {
  const where: Prisma.SubscriptionWhereInput = params.status
    ? { status: params.status }
    : {}

  const [items, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      include: {
        plan: true,
        user: { select: { uid: true, email: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      ...toSkipTake(params.pagination),
    }),
    prisma.subscription.count({ where }),
  ])

  return {
    items: items.map((subscription) => ({
      id: subscription.id,
      user: subscription.user,
      planName: subscription.plan.name,
      planSlug: subscription.plan.slug,
      principal: serialize(subscription.principal),
      totalAccrued: serialize(subscription.totalAccrued),
      status: subscription.status,
      startedAt: subscription.startedAt,
      endsAt: subscription.endsAt,
      lastAccruedOn: subscription.lastAccruedOn,
    })),
    total,
  }
}

/**
 * Cancels on the user's behalf, returning the principal exactly as a
 * self-service cancellation does — the same ledger entry, the same email. The
 * only difference is who pressed the button, which the audit log records.
 */
export async function adminCancelSubscription(params: {
  subscriptionId: string
  adminId: string
  ip?: string | undefined
}): Promise<void> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: params.subscriptionId },
  })
  if (!subscription) throw new NotFoundError("Subscription")

  await cancelSubscription(subscription.userId, subscription.id)

  await recordAudit({
    actorId: params.adminId,
    action: "subscription.cancel",
    targetType: "Subscription",
    targetId: subscription.id,
    after: {
      userId: subscription.userId,
      principalReturned: serialize(subscription.principal),
    },
    ip: params.ip,
  })
}
