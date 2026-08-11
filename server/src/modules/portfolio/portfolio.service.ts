import { TxCategory, TxStatus, TxType } from "@prisma/client"

import type { PerformancePeriod } from "../../config/constants.js"
import { ZERO, round2, serialize, type Money } from "../../lib/money.js"
import { prisma } from "../../lib/prisma.js"
import {
  getBalanceSnapshot,
  sumCategory,
} from "../../services/ledger.service.js"

/**
 * Portfolio figures, all derived from the ledger.
 *
 * Two behavioural fixes over SwiftEdge:
 *  - date buckets are UTC, not server-local, so `todayProfit` is correct for
 *    every user regardless of where the host happens to run;
 *  - the performance series zero-fills gaps and starts from invested capital,
 *    so the chart is portfolio value over uniform intervals rather than a
 *    cumulative-profit line with missing days.
 */

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export interface PortfolioSummary {
  balance: string
  available: string
  reserved: string
  investedCapital: string
  profitEarned: string
  todayProfit: string
  yesterdayProfit: string
  weekProfit: string
  totalReturnPercent: string
  holdingsValue: string
  holdings: Array<{
    id: string
    name: string
    symbol: string
    units: string
    valueUsd: string
  }>
}

export async function getSummary(userId: string): Promise<PortfolioSummary> {
  const todayStart = startOfUtcDay(new Date())
  const tomorrowStart = addUtcDays(todayStart, 1)
  const yesterdayStart = addUtcDays(todayStart, -1)
  // ISO week-ish: last 7 days including today.
  const weekStart = addUtcDays(todayStart, -6)

  const [
    snapshot,
    deposited,
    profitEarned,
    todayProfit,
    yesterdayProfit,
    weekProfit,
    holdings,
  ] = await Promise.all([
    getBalanceSnapshot(userId),
    sumCategory(userId, [TxCategory.DEPOSIT, TxCategory.HOLDING]),
    sumCategory(userId, [TxCategory.PROFIT, TxCategory.PLAN_PAYOUT]),
    sumCategory(userId, [TxCategory.PROFIT, TxCategory.PLAN_PAYOUT], {
      from: todayStart,
      to: tomorrowStart,
    }),
    sumCategory(userId, [TxCategory.PROFIT, TxCategory.PLAN_PAYOUT], {
      from: yesterdayStart,
      to: todayStart,
    }),
    sumCategory(userId, [TxCategory.PROFIT, TxCategory.PLAN_PAYOUT], {
      from: weekStart,
      to: tomorrowStart,
    }),
    prisma.holding.findMany({
      where: { userId, archivedAt: null },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const holdingsValue = holdings.reduce<Money>(
    (total, holding) => total.add(holding.valueUsd),
    ZERO
  )

  const totalReturnPercent = deposited.greaterThan(0)
    ? round2(profitEarned.div(deposited).mul(100))
    : ZERO

  return {
    balance: serialize(snapshot.balance),
    available: serialize(snapshot.available),
    reserved: serialize(snapshot.reserved),
    investedCapital: serialize(deposited),
    profitEarned: serialize(profitEarned),
    todayProfit: serialize(todayProfit),
    yesterdayProfit: serialize(yesterdayProfit),
    weekProfit: serialize(weekProfit),
    totalReturnPercent: totalReturnPercent.toFixed(2),
    holdingsValue: serialize(holdingsValue),
    holdings: holdings.map((holding) => ({
      id: holding.id,
      name: holding.name,
      symbol: holding.symbol,
      units: holding.units.toString(),
      valueUsd: serialize(holding.valueUsd),
    })),
  }
}

export interface PerformancePoint {
  date: string
  value: string
  change: string
}

const PERIOD_DAYS: Record<Exclude<PerformancePeriod, "all">, number> = {
  "7d": 7,
  "1m": 30,
  "3m": 90,
  "1y": 365,
}

/**
 * Portfolio value over time, bucketed by UTC day and zero-filled so the
 * x-axis is uniform. SwiftEdge omitted days with no activity entirely, so a
 * 7-day chart with two entries drew two points at irregular spacing.
 */
export async function getPerformance(
  userId: string,
  period: PerformancePeriod
): Promise<{ period: PerformancePeriod; points: PerformancePoint[] }> {
  const todayStart = startOfUtcDay(new Date())

  let from: Date
  if (period === "all") {
    const first = await prisma.transaction.findFirst({
      where: { userId, status: TxStatus.COMPLETED },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    })
    from = first ? startOfUtcDay(first.createdAt) : addUtcDays(todayStart, -29)
  } else {
    from = addUtcDays(todayStart, -(PERIOD_DAYS[period] - 1))
  }

  const [opening, entries] = await Promise.all([
    // Everything settled before the window starts is the opening value.
    prisma.transaction.groupBy({
      by: ["type"],
      where: {
        userId,
        status: TxStatus.COMPLETED,
        createdAt: { lt: from },
      },
      _sum: { amount: true },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        status: TxStatus.COMPLETED,
        createdAt: { gte: from },
      },
      select: { type: true, amount: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ])

  const openingCredit =
    opening.find((row) => row.type === TxType.CREDIT)?._sum.amount ?? ZERO
  const openingDebit =
    opening.find((row) => row.type === TxType.DEBIT)?._sum.amount ?? ZERO

  // Net movement per UTC day.
  const deltaByDay = new Map<string, Money>()
  for (const entry of entries) {
    const key = startOfUtcDay(entry.createdAt).toISOString().slice(0, 10)
    const signed =
      entry.type === TxType.CREDIT ? entry.amount : entry.amount.negated()
    deltaByDay.set(key, (deltaByDay.get(key) ?? ZERO).add(signed))
  }

  const points: PerformancePoint[] = []
  let running = round2(openingCredit.sub(openingDebit))

  for (
    let cursor = new Date(from);
    cursor <= todayStart;
    cursor = addUtcDays(cursor, 1)
  ) {
    const key = cursor.toISOString().slice(0, 10)
    const change = deltaByDay.get(key) ?? ZERO
    running = round2(running.add(change))

    points.push({
      date: key,
      value: serialize(running),
      change: serialize(change),
    })
  }

  return { period, points }
}
