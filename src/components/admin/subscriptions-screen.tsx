"use client"

import { useState } from "react"
import Link from "next/link"

import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { DataTable, type Column } from "@/components/app/data-table"
import { Money } from "@/components/app/money"
import { PageHeader } from "@/components/app/page-header"
import { StatusBadge } from "@/components/app/status-badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import * as api from "@/lib/api/endpoints"
import type { AdminSubscriptionRow, SubscriptionStatus } from "@/lib/api/types"
import { formatDate, formatDateTime } from "@/lib/format"
import { useAsyncData } from "@/lib/use-async-data"

const STATUSES: Array<{ value: SubscriptionStatus | ""; label: string }> = [
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "", label: "All" },
]

/**
 * Every subscription on the platform.
 *
 * Cancelling here runs the same path a user's own cancellation does — the
 * principal is returned as a `PLAN_PRINCIPAL` credit and the same email goes
 * out. The only difference is who pressed it, which the audit log records.
 */
export function AdminSubscriptionsScreen() {
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<SubscriptionStatus | "">("ACTIVE")
  const [cancelling, setCancelling] = useState<AdminSubscriptionRow | null>(null)
  const [busy, setBusy] = useState(false)

  const result = useAsyncData(
    () =>
      api.admin.subscriptions({
        page,
        limit: 20,
        ...(status ? { status } : {}),
      }),
    `admin-subscriptions:${page}:${status}`
  )

  async function cancel() {
    if (!cancelling) return
    setBusy(true)
    try {
      await api.admin.cancelSubscription(cancelling.id)
      toast.success(
        "Subscription cancelled",
        "The principal has been returned to the user's balance."
      )
      setCancelling(null)
      result.reload()
    } catch (cause) {
      toast.fromError(cause, "Could not cancel that subscription.")
    } finally {
      setBusy(false)
    }
  }

  const columns: Column<AdminSubscriptionRow>[] = [
    {
      key: "user",
      header: "User",
      cell: (row) => (
        <Link
          href={`/admin/users/${row.user.uid}`}
          className="min-w-0 hover:underline"
        >
          <span className="block truncate font-medium text-secondary-900">
            {row.user.fullName}
          </span>
          <span className="block truncate text-xs text-secondary-500 tabular">
            {row.user.uid}
          </span>
        </Link>
      ),
    },
    {
      key: "plan",
      header: "Plan",
      cell: (row) => (
        <span className="font-medium text-secondary-900">{row.planName}</span>
      ),
    },
    {
      key: "principal",
      header: "Principal",
      cell: (row) => (
        <div>
          <Money value={row.principal} className="font-semibold" />
          <span className="block text-xs text-secondary-500">
            <Money value={row.totalAccrued} /> accrued
          </span>
        </div>
      ),
    },
    {
      key: "term",
      header: "Term",
      hideBelow: "md",
      cell: (row) => (
        <span className="whitespace-nowrap text-secondary-600 tabular">
          {formatDate(row.startedAt)} → {formatDate(row.endsAt)}
        </span>
      ),
    },
    {
      key: "accrued",
      header: "Last accrual",
      hideBelow: "lg",
      cell: (row) => (
        <span className="whitespace-nowrap text-secondary-600 tabular">
          {row.lastAccruedOn ? formatDateTime(row.lastAccruedOn) : "Never"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) =>
        row.status === "ACTIVE" ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-red-600 hover:bg-red-50"
            onClick={() => setCancelling(row)}
          >
            Cancel
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        title="Subscriptions"
        description="Every plan subscription on the platform. Returns accrue nightly at 00:05 UTC."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map((option) => (
          <button
            key={option.value || "all"}
            type="button"
            onClick={() => {
              setStatus(option.value)
              setPage(1)
            }}
            aria-pressed={status === option.value}
            className={
              status === option.value
                ? "rounded-lg bg-primary-600 px-3.5 py-2 text-sm font-semibold text-white"
                : "rounded-lg border border-secondary-200 bg-white px-3.5 py-2 text-sm font-semibold text-secondary-700 hover:border-primary-300"
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={result.data?.items ?? []}
        getRowKey={(row) => row.id}
        loading={result.loading && !result.data}
        error={result.error}
        onRetry={result.reload}
        meta={result.data?.meta}
        onPageChange={setPage}
        empty={{
          title: "No subscriptions",
          description:
            status === "ACTIVE"
              ? "Nobody has an active plan right now."
              : "Nothing matches this filter.",
        }}
      />

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(next) => !busy && !next && setCancelling(null)}
        title="Cancel this subscription?"
        description={
          cancelling
            ? `${cancelling.user.fullName}'s ${cancelling.planName} plan ends immediately. The principal returns to their balance; returns already accrued stay with them.`
            : undefined
        }
        confirmLabel="Cancel subscription"
        cancelLabel="Keep it running"
        tone="danger"
        busy={busy}
        onConfirm={() => void cancel()}
      >
        {cancelling && (
          <dl className="space-y-1 rounded-lg bg-secondary-50 p-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-secondary-500">Principal returned</dt>
              <dd className="font-semibold text-secondary-900">
                <Money value={cancelling.principal} />
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-secondary-500">Accrued so far</dt>
              <dd className="font-semibold text-secondary-900">
                <Money value={cancelling.totalAccrued} />
              </dd>
            </div>
          </dl>
        )}
      </ConfirmDialog>
    </div>
  )
}
