import {
  Prisma,
  SubscriptionStatus,
  TxCategory,
  type Plan,
  type Subscription,
} from "@prisma/client"

import { NotFoundError, ValidationError } from "../../lib/errors.js"
import { logger } from "../../lib/logger.js"
import { ZERO, bpsOf, round2, serialize, toMoney } from "../../lib/money.js"
import { prisma } from "../../lib/prisma.js"
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

  return prisma.$transaction(
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

    await tx.subscription.update({
      where: { id: subscription.id },
      data: { status: SubscriptionStatus.CANCELLED },
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
