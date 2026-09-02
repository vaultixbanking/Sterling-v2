"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Coins,
  Lock,
  PiggyBank,
  TrendingUp,
  Wallet,
} from "lucide-react"

import { AreaChart } from "@/components/app/area-chart"
import { DataTable, type Column } from "@/components/app/data-table"
import { EmptyState, ErrorState } from "@/components/app/empty-state"
import { Money } from "@/components/app/money"
import { PageHeader } from "@/components/app/page-header"
import { StatCard } from "@/components/app/stat-card"
import { StatusBadge } from "@/components/app/status-badge"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/ui/copy-button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/components/providers/auth-provider"
import * as api from "@/lib/api/endpoints"
import type {
  HoldingSummary,
  PerformancePeriod,
  Transaction,
} from "@/lib/api/types"
import { formatDate, formatPercent, formatUnits, isZero } from "@/lib/format"
import { useAsyncData } from "@/lib/use-async-data"
import { cn } from "@/lib/utils"

const PERIODS: Array<{ value: PerformancePeriod; label: string }> = [
  { value: "7d", label: "7D" },
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
]

export function DashboardScreen() {
  const { user } = useAuth()
  const [period, setPeriod] = useState<PerformancePeriod>("1m")

  const portfolio = useAsyncData(() => api.portfolio.summary(), "portfolio")
  const performance = useAsyncData(
    () => api.portfolio.performance(period),
    `performance:${period}`
  )
  const recent = useAsyncData(
    () => api.transactions.list({ limit: 5 }),
    "recent-transactions"
  )

  const summary = portfolio.data
  const firstName = user?.fullName?.split(" ")[0] ?? "there"

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Your balances, performance, and recent activity."
        actions={
          <>
            <Button asChild size="sm">
              <Link href="/deposit">
                <ArrowDownToLine className="size-4" />
                Deposit
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/withdraw">
                <ArrowUpFromLine className="size-4" />
                Withdraw
              </Link>
            </Button>
          </>
        }
      />

      {/*
        Support asks for this on every ticket, and it lived only in Settings and
        in the registration email — so people were hunting for it mid-conversation
        or giving their email address instead. It sits above the balances because
        it is reference information, not a metric: quiet, always in the same
        place, one tap to copy.
      */}
      {user?.uid && (
        <div className="mb-5 inline-flex items-center gap-2.5 rounded-xl border border-secondary-200/70 bg-white py-2 pr-2 pl-3.5 shadow-sm">
          <span className="text-xs font-medium text-secondary-500">
            Account ID
          </span>
          <span className="font-mono text-sm font-semibold tracking-wide text-secondary-900 tabular">
            {user.uid}
          </span>
          <CopyButton value={user.uid} label="Copy your account ID" />
        </div>
      )}

      {portfolio.error && !summary ? (
        <ErrorState
          title="Could not load your portfolio"
          description="Your balances are safe — this is a display problem."
          onRetry={portfolio.reload}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="Total balance"
              value={summary?.balance}
              icon={Wallet}
              tone="primary"
              loading={portfolio.loading && !summary}
            />
            <StatCard
              label="Invested capital"
              value={summary?.investedCapital}
              icon={PiggyBank}
              loading={portfolio.loading && !summary}
              sub={[{ label: "Holdings value", value: summary?.holdingsValue }]}
            />
            <StatCard
              label="Profit earned"
              value={summary?.profitEarned}
              icon={TrendingUp}
              loading={portfolio.loading && !summary}
              sub={[
                { label: "Today", value: summary?.todayProfit, signed: true },
                {
                  label: "Yesterday",
                  value: summary?.yesterdayProfit,
                  signed: true,
                },
                { label: "This week", value: summary?.weekProfit, signed: true },
              ]}
            />
          </div>

          {/* Reserved funds only exist while a withdrawal is awaiting review.
              Showing the split just then explains why the spendable figure is
              lower than the balance — SwiftEdge had no concept of this and left
              users to guess where the money had gone. */}
          {summary && !isZero(summary.reserved) && (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-white text-amber-600 shadow-sm">
                  <Lock className="size-4.5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-secondary-900">
                    <Money value={summary.reserved} /> is reserved
                  </p>
                  <p className="mt-0.5 text-sm text-secondary-600">
                    Held against a withdrawal awaiting review. It returns to your
                    available balance if the request is rejected or cancelled.
                  </p>
                </div>
              </div>
              <p className="shrink-0 text-sm text-secondary-600">
                Available:{" "}
                <Money
                  value={summary.available}
                  className="font-semibold text-secondary-900"
                />
              </p>
            </div>
          )}

          <section className="mt-6 rounded-2xl border border-secondary-100/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-heading text-lg font-bold text-secondary-900">
                  Performance
                </h3>
                {summary && (
                  <p className="mt-0.5 text-sm text-secondary-600">
                    Total return{" "}
                    <span
                      className={cn(
                        "font-semibold tabular",
                        summary.totalReturnPercent.startsWith("-")
                          ? "text-red-600"
                          : "text-emerald-600"
                      )}
                    >
                      {formatPercent(summary.totalReturnPercent, {
                        showPlus: true,
                      })}
                    </span>
                  </p>
                )}
              </div>

              <div
                className="flex shrink-0 gap-1 rounded-lg bg-secondary-100 p-1"
                role="group"
                aria-label="Chart period"
              >
                {PERIODS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPeriod(option.value)}
                    aria-pressed={period === option.value}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors outline-none focus-visible:ring-4 focus-visible:ring-primary-200",
                      period === option.value
                        ? "bg-white text-primary-700 shadow-sm"
                        : "text-secondary-600 hover:text-secondary-900"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {performance.error && !performance.data ? (
              <ErrorState
                title="Could not load the chart"
                onRetry={performance.reload}
              />
            ) : (
              <AreaChart
                points={performance.data?.points ?? []}
                loading={performance.loading && !performance.data}
              />
            )}
          </section>

          <div className="mt-6 grid gap-6 xl:grid-cols-5">
            <section className="xl:col-span-2">
              <h3 className="mb-3 font-heading text-lg font-bold text-secondary-900">
                Holdings
              </h3>
              <Holdings
                holdings={summary?.holdings ?? []}
                loading={portfolio.loading && !summary}
              />
            </section>

            <section className="min-w-0 xl:col-span-3">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-heading text-lg font-bold text-secondary-900">
                  Recent activity
                </h3>
                <Button asChild variant="link" size="sm">
                  <Link href="/transactions">View all</Link>
                </Button>
              </div>
              <RecentTransactions
                rows={recent.data?.items ?? []}
                loading={recent.loading && !recent.data}
                error={recent.error}
                onRetry={recent.reload}
              />
            </section>
          </div>
        </>
      )}
    </div>
  )
}

function Holdings({
  holdings,
  loading,
}: {
  holdings: HoldingSummary[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-[4.5rem] w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (holdings.length === 0) {
    return (
      <EmptyState
        icon={Coins}
        title="No holdings yet"
        description="Subscribe to an investment plan and your positions will appear here."
        action={{ label: "Browse plans", href: "/plans" }}
      />
    )
  }

  return (
    <ul className="space-y-3">
      {holdings.map((holding) => (
        <li
          key={holding.id}
          className="flex items-center gap-3 rounded-xl border border-secondary-100/80 bg-white p-4 shadow-sm"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-50 text-xs font-bold text-primary-700">
            {holding.symbol.slice(0, 4).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-secondary-900">
              {holding.name}
            </p>
            <p className="text-xs text-secondary-500 tabular">
              {formatUnits(holding.units)} {holding.symbol.toUpperCase()}
            </p>
          </div>
          <Money
            value={holding.valueUsd}
            className="shrink-0 text-sm font-semibold text-secondary-900"
          />
        </li>
      ))}
    </ul>
  )
}

function RecentTransactions({
  rows,
  loading,
  error,
  onRetry,
}: {
  rows: Transaction[]
  loading: boolean
  error: unknown
  onRetry: () => void
}) {
  const columns: Column<Transaction>[] = [
    {
      key: "description",
      header: "Activity",
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-secondary-900">
            {row.description ?? "—"}
          </p>
          <p className="text-xs text-secondary-500 sm:hidden">
            {formatDate(row.createdAt)}
          </p>
        </div>
      ),
    },
    {
      key: "date",
      header: "Date",
      hideBelow: "sm",
      cell: (row) => (
        <span className="whitespace-nowrap text-secondary-600 tabular">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      hideBelow: "md",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "amount",
      header: "Amount",
      className: "text-right",
      cell: (row) => (
        <Money
          // The ledger stores every amount as a positive figure and carries the
          // direction in `type`, so the sign has to be applied for display.
          value={row.type === "DEBIT" ? `-${row.amount}` : row.amount}
          signed
          className="font-semibold"
        />
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={{
        title: "No activity yet",
        description:
          "Deposits, profits, and withdrawals will show up here as they happen.",
        action: { label: "Make a deposit", href: "/deposit" },
      }}
    />
  )
}
