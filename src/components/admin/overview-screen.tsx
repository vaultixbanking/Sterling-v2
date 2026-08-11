"use client"

import Link from "next/link"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Lock,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react"

import { ErrorState } from "@/components/app/empty-state"
import { Money } from "@/components/app/money"
import { PageHeader } from "@/components/app/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import * as api from "@/lib/api/endpoints"
import { useAsyncData } from "@/lib/use-async-data"
import { cn } from "@/lib/utils"

/** Platform overview: who is here, what is queued, and what is owed. */
export function AdminOverviewScreen() {
  const stats = useAsyncData(() => api.admin.stats(), "admin-stats")
  const data = stats.data

  if (stats.error && !data) {
    return (
      <div className="mx-auto w-full max-w-7xl">
        <PageHeader title="Overview" />
        <ErrorState title="Could not load platform stats" onRetry={stats.reload} />
      </div>
    )
  }

  const loading = stats.loading && !data

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        title="Overview"
        description="Platform health, pending work, and client liability."
      />

      <section>
        <h3 className="mb-3 text-sm font-semibold tracking-wide text-secondary-500 uppercase">
          Needs attention
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <QueueCard
            href="/admin/deposits"
            label="Deposits awaiting review"
            count={data?.queues.pendingDeposits}
            icon={ArrowDownToLine}
            loading={loading}
          />
          <QueueCard
            href="/admin/withdrawals"
            label="Withdrawals awaiting review"
            count={data?.queues.pendingWithdrawals}
            icon={ArrowUpFromLine}
            loading={loading}
          />
        </div>
      </section>

      <section className="mt-8">
        <h3 className="mb-3 text-sm font-semibold tracking-wide text-secondary-500 uppercase">
          Users
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <CountCard
            label="Total users"
            value={data?.users.total}
            icon={Users}
            loading={loading}
          />
          <CountCard
            label="Active users"
            value={data?.users.active}
            icon={UserCheck}
            loading={loading}
          />
        </div>
      </section>

      <section className="mt-8">
        <h3 className="mb-3 text-sm font-semibold tracking-wide text-secondary-500 uppercase">
          Ledger
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MoneyCard
            label="Client liability"
            hint="What the platform owes clients"
            value={data?.ledger.clientLiability}
            icon={Wallet}
            tone="primary"
            loading={loading}
          />
          <MoneyCard
            label="Reserved"
            hint="Held against pending withdrawals"
            value={data?.ledger.reserved}
            icon={Lock}
            loading={loading}
          />
          <MoneyCard
            label="Total credited"
            value={data?.ledger.totalCredited}
            loading={loading}
          />
          <MoneyCard
            label="Total debited"
            value={data?.ledger.totalDebited}
            loading={loading}
          />
        </div>
      </section>
    </div>
  )
}

function QueueCard({
  href,
  label,
  count,
  icon: Icon,
  loading,
}: {
  href: string
  label: string
  count: number | undefined
  icon: typeof Users
  loading: boolean
}) {
  const waiting = (count ?? 0) > 0

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-4 rounded-2xl border p-5 shadow-sm transition-all outline-none",
        "hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-4 focus-visible:ring-primary-200",
        waiting
          ? "border-amber-300 bg-amber-50/70"
          : "border-secondary-100/80 bg-white"
      )}
    >
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-xl",
          waiting ? "bg-white text-amber-600" : "bg-secondary-50 text-secondary-400"
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-secondary-600">{label}</p>
        {loading ? (
          <Skeleton className="mt-1 h-7 w-12" />
        ) : (
          <p className="font-heading text-2xl font-bold text-secondary-900 tabular">
            {count ?? 0}
          </p>
        )}
      </div>
      <span className="shrink-0 text-sm font-semibold text-primary-600">
        Review →
      </span>
    </Link>
  )
}

function CountCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string
  value: number | undefined
  icon: typeof Users
  loading: boolean
}) {
  return (
    <div className="rounded-2xl border border-secondary-100/80 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-secondary-600">{label}</p>
        <span className="grid size-9 place-items-center rounded-lg bg-primary-50 text-primary-600">
          <Icon className="size-4.5" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <p className="mt-2 font-heading text-2xl font-bold text-secondary-900 tabular">
          {value ?? 0}
        </p>
      )}
    </div>
  )
}

function MoneyCard({
  label,
  hint,
  value,
  icon: Icon,
  tone = "neutral",
  loading,
}: {
  label: string
  hint?: string
  value: string | undefined
  icon?: typeof Users
  tone?: "neutral" | "primary"
  loading: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 shadow-sm",
        tone === "primary"
          ? "border-primary-600 bg-primary-600 text-white"
          : "border-secondary-100/80 bg-white"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={cn(
              "text-sm",
              tone === "primary" ? "text-primary-100" : "text-secondary-600"
            )}
          >
            {label}
          </p>
          {hint && (
            <p
              className={cn(
                "mt-0.5 text-xs",
                tone === "primary" ? "text-primary-200" : "text-secondary-400"
              )}
            >
              {hint}
            </p>
          )}
        </div>
        {Icon && (
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-lg",
              tone === "primary"
                ? "bg-white/15 text-white"
                : "bg-primary-50 text-primary-600"
            )}
          >
            <Icon className="size-4.5" />
          </span>
        )}
      </div>

      {loading ? (
        <Skeleton className="mt-3 h-8 w-32" />
      ) : (
        <p
          className={cn(
            "mt-3 font-heading text-2xl font-bold tabular",
            tone === "primary" ? "text-white" : "text-secondary-900"
          )}
        >
          <Money value={value} />
        </p>
      )}
    </div>
  )
}
