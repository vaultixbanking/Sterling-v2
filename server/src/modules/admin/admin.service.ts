import {
  type Prisma,
  RequestStatus,
  TxCategory,
  TxStatus,
  TxType,
  UserStatus,
  type Holding,
} from "@prisma/client"

import { NotFoundError, ValidationError } from "../../lib/errors.js"
import { logger } from "../../lib/logger.js"
import { ZERO, round2, serialize, toMoney } from "../../lib/money.js"
import type { Pagination } from "../../lib/pagination.js"
import { toSkipTake } from "../../lib/pagination.js"
import { prisma } from "../../lib/prisma.js"
import { recordAudit } from "../../services/audit.service.js"
import {
  sendAccountCreditedEmail,
  sendAccountReactivatedEmail,
  sendAccountSuspendedEmail,
} from "../../services/email/email.service.js"
import { credit, debit, getBalanceSnapshot } from "../../services/ledger.service.js"

/**
 * Admin operations.
 *
 * Everything here is gated by `requireAdmin`. In SwiftEdge the equivalent
 * routes were mounted behind the *user* middleware, which meant any customer
 * could call them.
 */

export async function listUsers(params: {
  pagination: Pagination
  search?: string | undefined
  status?: UserStatus | undefined
}) {
  const search = params.search?.trim()

  const where: Prisma.UserWhereInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" } },
            { username: { contains: search, mode: "insensitive" } },
            { fullName: { contains: search, mode: "insensitive" } },
            { uid: { equals: search.toUpperCase() } },
          ],
        }
      : {}),
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...toSkipTake(params.pagination),
    }),
    prisma.user.count({ where }),
  ])

  // Balances for the page in one grouped query rather than N round-trips.
  const ids = users.map((user) => user.id)
  const buckets = ids.length
    ? await prisma.transaction.groupBy({
        by: ["userId", "type", "status"],
        where: {
          userId: { in: ids },
          status: { in: [TxStatus.COMPLETED, TxStatus.PENDING] },
        },
        _sum: { amount: true },
      })
    : []

  const balances = new Map<string, { balance: string; available: string }>()
  for (const id of ids) {
    const rows = buckets.filter((bucket) => bucket.userId === id)
    const find = (type: TxType, status: TxStatus) =>
      rows.find((row) => row.type === type && row.status === status)?._sum
        .amount ?? ZERO

    const balance = round2(
      find(TxType.CREDIT, TxStatus.COMPLETED).sub(
        find(TxType.DEBIT, TxStatus.COMPLETED)
      )
    )
    const available = round2(balance.sub(find(TxType.DEBIT, TxStatus.PENDING)))
    balances.set(id, {
      balance: serialize(balance),
      available: serialize(available),
    })
  }

  return {
    items: users.map((user) => ({
      id: user.id,
      uid: user.uid,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      balance: balances.get(user.id)?.balance ?? "0.00",
      available: balances.get(user.id)?.available ?? "0.00",
    })),
    total,
  }
}

export async function getUserDetail(uid: string) {
  const user = await prisma.user.findUnique({
    where: { uid },
    include: {
      holdings: { where: { archivedAt: null }, orderBy: { createdAt: "desc" } },
      subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" } },
    },
  })

  if (!user) throw new NotFoundError("User")

  const [snapshot, recentTransactions] = await Promise.all([
    getBalanceSnapshot(user.id),
    prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ])

  return {
    user: {
      id: user.id,
      uid: user.uid,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      lastLoginIp: user.lastLoginIp,
      createdAt: user.createdAt,
    },
    balance: {
      balance: serialize(snapshot.balance),
      available: serialize(snapshot.available),
      reserved: serialize(snapshot.reserved),
    },
    holdings: user.holdings.map(serializeHolding),
    subscriptions: user.subscriptions.map((subscription) => ({
      id: subscription.id,
      planName: subscription.plan.name,
      principal: serialize(subscription.principal),
      totalAccrued: serialize(subscription.totalAccrued),
      status: subscription.status,
      endsAt: subscription.endsAt,
    })),
    recentTransactions: recentTransactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      category: tx.category,
      amount: serialize(tx.amount),
      status: tx.status,
      description: tx.description,
      createdAt: tx.createdAt,
    })),
  }
}

function serializeHolding(holding: Holding) {
  return {
    id: holding.id,
    name: holding.name,
    symbol: holding.symbol,
    units: holding.units.toString(),
    valueUsd: serialize(holding.valueUsd),
    createdAt: holding.createdAt,
  }
}

export async function setUserStatus(params: {
  uid: string
  status: UserStatus
  adminId: string
  ip?: string | undefined
}) {
  const user = await prisma.user.findUnique({ where: { uid: params.uid } })
  if (!user) throw new NotFoundError("User")

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { status: params.status },
  })

  await recordAudit({
    actorId: params.adminId,
    action: "user.status.change",
    targetType: "User",
    targetId: user.id,
    before: { status: user.status },
    after: { status: params.status },
    ip: params.ip,
  })

  // Losing access to an account holding your money without being told is the
  // kind of silence that turns into a chargeback. Only mail on an actual
  // transition — re-saving the same status should not re-notify.
  if (updated.status !== user.status) {
    const notice =
      updated.status === UserStatus.SUSPENDED
        ? sendAccountSuspendedEmail(updated, null)
        : user.status === UserStatus.SUSPENDED &&
            updated.status === UserStatus.ACTIVE
          ? sendAccountReactivatedEmail(updated)
          : null

    void notice?.catch((error: unknown) => {
      logger.error({ err: error }, "Account status email failed")
    })
  }

  return updated
}

/**
 * Credit or debit an account manually.
 *
 * SwiftEdge could only ever add profit — its Profit model enforced `min: 0`,
 * so a loss was literally impossible to record and there was no way to reverse
 * a mistaken credit.
 */
export async function createAdjustment(params: {
  uid: string
  direction: "credit" | "debit"
  amount: number
  category: TxCategory
  description?: string | undefined
  adminId: string
  ip?: string | undefined
  notify?: boolean | undefined
}) {
  const user = await prisma.user.findUnique({ where: { uid: params.uid } })
  if (!user) throw new NotFoundError("User")

  const amount = round2(toMoney(params.amount))
  if (!amount.greaterThan(0)) {
    throw new ValidationError("Amount must be greater than zero.")
  }

  const transaction =
    params.direction === "credit"
      ? await credit({
          userId: user.id,
          amount,
          category: params.category,
          description: params.description ?? undefined,
          processedById: params.adminId,
        })
      : await debit({
          userId: user.id,
          amount,
          category: params.category,
          description: params.description ?? undefined,
          processedById: params.adminId,
          status: TxStatus.COMPLETED,
        })

  await recordAudit({
    actorId: params.adminId,
    action: `adjustment.${params.direction}`,
    targetType: "User",
    targetId: user.id,
    after: {
      transactionId: transaction.id,
      amount: serialize(amount),
      category: params.category,
      description: params.description ?? null,
    },
    ip: params.ip,
  })

  const snapshot = await getBalanceSnapshot(user.id)

  if (params.direction === "credit" && params.notify !== false) {
    void sendAccountCreditedEmail(
      user,
      serialize(amount),
      params.description ?? null,
      serialize(snapshot.balance)
    ).catch((error: unknown) => {
      logger.error({ err: error }, "Account credited email failed")
    })
  }

  return {
    transaction: {
      id: transaction.id,
      type: transaction.type,
      category: transaction.category,
      amount: serialize(transaction.amount),
      status: transaction.status,
      createdAt: transaction.createdAt,
    },
    balance: serialize(snapshot.balance),
    available: serialize(snapshot.available),
  }
}

/**
 * Adds a holding. Optionally also credits the ledger for its value, which is
 * what SwiftEdge did unconditionally — conflating "record an asset position"
 * with "give the user money".
 */
export async function addHolding(params: {
  uid: string
  name: string
  symbol: string
  units: number
  valueUsd: number
  creditLedger: boolean
  adminId: string
  ip?: string | undefined
}) {
  const user = await prisma.user.findUnique({ where: { uid: params.uid } })
  if (!user) throw new NotFoundError("User")

  const valueUsd = round2(toMoney(params.valueUsd))
  if (valueUsd.lessThan(0)) {
    throw new ValidationError("Holding value cannot be negative.")
  }

  const holding = await prisma.$transaction(async (tx) => {
    const record = await tx.holding.create({
      data: {
        userId: user.id,
        name: params.name,
        symbol: params.symbol.toUpperCase(),
        units: toMoney(params.units),
        valueUsd,
      },
    })

    if (params.creditLedger && valueUsd.greaterThan(0)) {
      await credit(
        {
          userId: user.id,
          amount: valueUsd,
          category: TxCategory.HOLDING,
          description: `${params.name} position added`,
          metadata: { holdingId: record.id, symbol: record.symbol },
          processedById: params.adminId,
        },
        tx
      )
    }

    return record
  })

  await recordAudit({
    actorId: params.adminId,
    action: "holding.create",
    targetType: "Holding",
    targetId: holding.id,
    after: {
      userId: user.id,
      symbol: holding.symbol,
      valueUsd: serialize(valueUsd),
      creditedLedger: params.creditLedger,
    },
    ip: params.ip,
  })

  return serializeHolding(holding)
}

export async function updateHolding(params: {
  holdingId: string
  units?: number | undefined
  valueUsd?: number | undefined
  adminId: string
  ip?: string | undefined
}) {
  const existing = await prisma.holding.findUnique({
    where: { id: params.holdingId },
  })
  if (!existing) throw new NotFoundError("Holding")

  const holding = await prisma.holding.update({
    where: { id: params.holdingId },
    data: {
      ...(params.units !== undefined ? { units: toMoney(params.units) } : {}),
      ...(params.valueUsd !== undefined
        ? { valueUsd: round2(toMoney(params.valueUsd)) }
        : {}),
    },
  })

  await recordAudit({
    actorId: params.adminId,
    action: "holding.update",
    targetType: "Holding",
    targetId: holding.id,
    before: {
      units: existing.units.toString(),
      valueUsd: serialize(existing.valueUsd),
    },
    after: {
      units: holding.units.toString(),
      valueUsd: serialize(holding.valueUsd),
    },
    ip: params.ip,
  })

  return serializeHolding(holding)
}

export async function archiveHolding(params: {
  holdingId: string
  adminId: string
  ip?: string | undefined
}) {
  const holding = await prisma.holding.findUnique({
    where: { id: params.holdingId },
  })
  if (!holding) throw new NotFoundError("Holding")

  await prisma.holding.update({
    where: { id: params.holdingId },
    data: { archivedAt: new Date() },
  })

  await recordAudit({
    actorId: params.adminId,
    action: "holding.archive",
    targetType: "Holding",
    targetId: holding.id,
    ip: params.ip,
  })
}

export async function listAuditLogs(pagination: Pagination) {
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { username: true, email: true } } },
      ...toSkipTake(pagination),
    }),
    prisma.auditLog.count(),
  ])

  return { items, total }
}

export async function getStats() {
  const [
    userCount,
    activeUsers,
    pendingDeposits,
    pendingWithdrawals,
    credited,
    debited,
    reserved,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "USER" } }),
    prisma.user.count({ where: { role: "USER", status: UserStatus.ACTIVE } }),
    prisma.depositRequest.count({ where: { status: RequestStatus.PENDING } }),
    prisma.withdrawalRequest.count({ where: { status: RequestStatus.PENDING } }),
    prisma.transaction.aggregate({
      where: { type: TxType.CREDIT, status: TxStatus.COMPLETED },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: TxType.DEBIT, status: TxStatus.COMPLETED },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: TxType.DEBIT, status: TxStatus.PENDING },
      _sum: { amount: true },
    }),
  ])

  const totalCredited = credited._sum.amount ?? ZERO
  const totalDebited = debited._sum.amount ?? ZERO

  return {
    users: { total: userCount, active: activeUsers },
    queues: { pendingDeposits, pendingWithdrawals },
    ledger: {
      totalCredited: serialize(totalCredited),
      totalDebited: serialize(totalDebited),
      /** Platform-wide liability to clients. */
      clientLiability: serialize(round2(totalCredited.sub(totalDebited))),
      reserved: serialize(reserved._sum.amount ?? ZERO),
    },
  }
}
