import {
  type Prisma,
  RequestStatus,
  TxCategory,
  TxStatus,
  TxType,
  UserStatus,
  type Holding,
} from "@prisma/client"

import {
  InsufficientFundsError,
  NotFoundError,
  ValidationError,
} from "../../lib/errors.js"
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
  sendAccountDebitedEmail,
  sendHoldingAddedEmail,
  sendProfitCreditedEmail,
} from "../../services/email/email.service.js"
import {
  credit,
  debit,
  getBalanceSnapshot,
  type Db,
} from "../../services/ledger.service.js"

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
            // Was `equals: search.toUpperCase()`. Uppercasing suited UIDs this
            // system generates, which are uppercase by construction — but the
            // accounts carried over from the old platform have lowercase hex
            // UIDs like "3e1b9959", and uppercasing made them permanently
            // unfindable. `equals` also meant a partial UID matched nothing,
            // which is how an admin actually types one they are reading off a
            // support message.
            { uid: { contains: search, mode: "insensitive" } },
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

  // The two directions default differently, on purpose. Money arriving is news
  // the user wants, so a credit notifies unless silenced. Money leaving is
  // usually an admin correcting their own slip moments later, and mailing about
  // that turns a quiet fix into an alarming one — so a debit stays silent
  // unless the admin explicitly asks for it, per entry.
  const notifying =
    params.direction === "credit"
      ? params.notify !== false
      : params.notify === true

  if (params.direction === "debit" && notifying) {
    void sendAccountDebitedEmail(
      user,
      serialize(amount),
      params.description ?? null,
      serialize(snapshot.balance)
    ).catch((error: unknown) => {
      logger.error({ err: error }, "Account debited email failed")
    })
  }

  if (params.direction === "credit" && notifying) {
    // Profit gets its own words. Earning a return and having a mistyped figure
    // corrected used to arrive as the same "Your account has been credited",
    // which made the one thing the platform sells indistinguishable from
    // routine bookkeeping.
    const earned =
      params.category === TxCategory.PROFIT ||
      params.category === TxCategory.PLAN_PAYOUT

    const notice = earned
      ? sendProfitCreditedEmail(
          user,
          serialize(amount),
          params.description ?? null,
          serialize(snapshot.balance)
        )
      : sendAccountCreditedEmail(
          user,
          serialize(amount),
          params.description ?? null,
          serialize(snapshot.balance)
        )

    void notice.catch((error: unknown) => {
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

  // Whether this booking moves money. Decided once, so the audit trail and the
  // notification cannot disagree with what the ledger actually did.
  const credited = params.creditLedger && valueUsd.greaterThan(0)

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

    if (credited) {
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
      creditedLedger: credited,
    },
    ip: params.ip,
  })

  // Only when money actually moved. Most positions booked here are a manual
  // payment the desk is recording on the user's behalf — and those users are
  // the least likely to open the dashboard and notice, so silence was the
  // wrong default. Recording an asset the account was never funded for stays
  // silent: nothing happened to their money.
  //
  // Fire-and-forget after the commit, like every other notification here: a
  // mail outage must never roll back a settled ledger entry.
  if (credited) {
    const snapshot = await getBalanceSnapshot(user.id)

    void sendHoldingAddedEmail(user, {
      name: holding.name,
      symbol: holding.symbol,
      units: holding.units.toString(),
      valueUsd: serialize(valueUsd),
      newBalance: serialize(snapshot.balance),
    }).catch((error: unknown) => {
      logger.error({ err: error }, "Holding added email failed")
    })
  }

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

/**
 * Finds the credit a holding put on the ledger, if it put one there.
 *
 * The link is the `holdingId` written into the transaction's metadata when the
 * position was booked — there is no foreign key, because a holding may or may
 * not have moved money and a nullable column would have implied it always
 * could.
 */
async function findHoldingCredit(holdingId: string, db: Db = prisma) {
  return db.transaction.findFirst({
    where: {
      type: TxType.CREDIT,
      category: TxCategory.HOLDING,
      status: TxStatus.COMPLETED,
      metadata: { path: ["holdingId"], equals: holdingId },
    },
  })
}

/**
 * Archives a position and, by default, takes back the money it added.
 *
 * Archiving used to remove the position from the dashboard and leave its
 * `CREDIT / HOLDING` row untouched, so the balance kept money that no position
 * explained. Now that booking a holding credits by default, that orphan would
 * have been the common case rather than the rare one.
 *
 * The reversal is a real `DEBIT / HOLDING`, not a deletion: the ledger is
 * append-only, and `sumCategory` nets the pair so invested capital comes back
 * down too. If the user has already spent the money the debit cannot settle —
 * that is surfaced rather than swallowed, and the admin can archive without
 * reversing if they mean to write it off.
 */
export async function archiveHolding(params: {
  holdingId: string
  adminId: string
  reverseLedger?: boolean | undefined
  /** Opt-in, like a manual debit — see `createAdjustment`. */
  notify?: boolean | undefined
  ip?: string | undefined
}) {
  const holding = await prisma.holding.findUnique({
    where: { id: params.holdingId },
  })
  if (!holding) throw new NotFoundError("Holding")
  // Guards against double-reversal: archiving twice would otherwise debit twice.
  if (holding.archivedAt) {
    throw new ValidationError("That holding is already archived.")
  }

  const reversing = params.reverseLedger !== false
  const original = reversing ? await findHoldingCredit(holding.id) : null

  let reversalId: string | null = null

  await prisma.$transaction(async (tx) => {
    if (original) {
      try {
        const reversal = await debit(
          {
            userId: holding.userId,
            amount: original.amount,
            category: TxCategory.HOLDING,
            description: `${holding.name} position removed — credit reversed`,
            metadata: { holdingId: holding.id, reversesTransactionId: original.id },
            processedById: params.adminId,
            status: TxStatus.COMPLETED,
          },
          tx
        )
        reversalId = reversal.id
      } catch (error) {
        if (error instanceof InsufficientFundsError) {
          throw new ValidationError(
            `Cannot reverse this position: the account no longer holds the ${serialize(original.amount)} it added. Archive without reversing to write it off instead.`
          )
        }
        throw error
      }
    }

    await tx.holding.update({
      where: { id: holding.id },
      data: { archivedAt: new Date() },
    })
  })

  await recordAudit({
    actorId: params.adminId,
    action: "holding.archive",
    targetType: "Holding",
    targetId: holding.id,
    after: {
      reversedLedger: Boolean(reversalId),
      reversalTransactionId: reversalId,
      amount: original ? serialize(original.amount) : null,
    },
    ip: params.ip,
  })

  // Only when money actually left, and only if asked. `original` carries the
  // amount because `reversalId` alone cannot say how much came back out.
  if (reversalId && original && params.notify === true) {
    const user = await prisma.user.findUnique({ where: { id: holding.userId } })
    const snapshot = await getBalanceSnapshot(holding.userId)

    if (user) {
      void sendAccountDebitedEmail(
        user,
        serialize(original.amount),
        `${holding.name} position removed`,
        serialize(snapshot.balance)
      ).catch((error: unknown) => {
        logger.error({ err: error }, "Holding reversal email failed")
      })
    }
  }

  return { reversed: Boolean(reversalId) }
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
