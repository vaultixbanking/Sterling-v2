"use client"

import { useState } from "react"
import Link from "next/link"

import { DataTable, type Column } from "@/components/app/data-table"
import { Money } from "@/components/app/money"
import { PageHeader } from "@/components/app/page-header"
import { StatusBadge } from "@/components/app/status-badge"
import { ReviewDialog } from "@/components/admin/review-dialog"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/ui/copy-button"
import { useToast } from "@/components/ui/toast"
import * as api from "@/lib/api/endpoints"
import type {
  AdminWithdrawalRow,
  RequestStatus,
  WithdrawalDestination,
} from "@/lib/api/types"
import { formatDateTime } from "@/lib/format"
import { useAsyncData } from "@/lib/use-async-data"

const STATUSES: Array<{ value: RequestStatus | ""; label: string }> = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "", label: "All" },
]

function isCrypto(
  destination: WithdrawalDestination
): destination is Extract<WithdrawalDestination, { walletAddress: string }> {
  return "walletAddress" in destination
}

/** The withdrawal queue, with the destination details needed to actually pay. */
export function AdminWithdrawalsScreen() {
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<RequestStatus | "">("PENDING")
  const [review, setReview] = useState<{
    row: AdminWithdrawalRow
    action: "approve" | "reject"
  } | null>(null)
  const [busy, setBusy] = useState(false)

  const result = useAsyncData(
    () =>
      api.admin.withdrawals({ page, limit: 20, ...(status ? { status } : {}) }),
    `admin-withdrawals:${page}:${status}`
  )

  async function submit(note: string) {
    if (!review) return
    setBusy(true)
    try {
      await api.admin.processWithdrawal(
        review.row.id,
        review.action,
        note || undefined
      )
      toast.success(
        review.action === "approve"
          ? "Withdrawal approved"
          : "Withdrawal rejected",
        review.action === "approve"
          ? "The reserved amount has been debited. Send the payment now."
          : "The reserved amount has returned to the user's balance."
      )
      setReview(null)
      result.reload()
    } catch (cause) {
      toast.fromError(cause, "Could not process that withdrawal.")
    } finally {
      setBusy(false)
    }
  }

  const columns: Column<AdminWithdrawalRow>[] = [
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
      key: "amount",
      header: "Amount",
      cell: (row) => (
        <div>
          <Money value={row.amount} className="font-semibold" />
          <span className="block text-xs text-secondary-500">
            fee <Money value={row.fee} />
          </span>
        </div>
      ),
    },
    {
      key: "destination",
      header: "Destination",
      hideBelow: "md",
      cell: (row) => <Destination destination={row.destination} />,
    },
    {
      key: "created",
      header: "Requested",
      hideBelow: "lg",
      cell: (row) => (
        <span className="whitespace-nowrap text-secondary-600 tabular">
          {formatDateTime(row.createdAt)}
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
        row.status === "PENDING" ? (
          <div className="flex justify-end gap-1.5">
            <Button size="sm" onClick={() => setReview({ row, action: "approve" })}>
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
              onClick={() => setReview({ row, action: "reject" })}
            >
              Reject
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        title="Withdrawals"
        description="Approve only after you have sent — or are about to send — the payment."
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
          title: status === "PENDING" ? "Nothing waiting" : "No withdrawals here",
          description:
            status === "PENDING"
              ? "New withdrawal requests will appear here for review."
              : "Try another status filter.",
        }}
      />

      <ReviewDialog
        open={review !== null}
        onOpenChange={(next) => !next && setReview(null)}
        action={review?.action ?? "approve"}
        title={
          review?.action === "approve"
            ? "Approve this withdrawal?"
            : "Reject this withdrawal?"
        }
        summary={
          review && (
            <dl className="space-y-1">
              <div className="flex justify-between">
                <dt className="text-secondary-600">User</dt>
                <dd className="font-medium">{review.row.user.fullName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-secondary-600">Amount</dt>
                <dd className="font-bold">
                  <Money value={review.row.amount} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-secondary-600">Fee</dt>
                <dd className="font-medium">
                  <Money value={review.row.fee} />
                </dd>
              </div>
              <div className="mt-2 border-t border-secondary-200 pt-2">
                <Destination destination={review.row.destination} expanded />
              </div>
              {review.action === "approve" && (
                <p className="mt-2 text-xs text-secondary-600">
                  Approving debits the reserved funds. It does not move real
                  money — send the payment yourself.
                </p>
              )}
            </dl>
          )
        }
        busy={busy}
        onSubmit={(note) => void submit(note)}
      />
    </div>
  )
}

function Destination({
  destination,
  expanded = false,
}: {
  destination: WithdrawalDestination
  expanded?: boolean
}) {
  if (isCrypto(destination)) {
    return (
      <div className="min-w-0">
        <p className="text-xs font-semibold text-secondary-700">
          {destination.currency ?? "Crypto"} · {destination.network}
        </p>
        <div className="flex items-center gap-1">
          <code
            className={
              expanded
                ? "font-mono text-xs break-all text-secondary-600"
                : "block max-w-[14rem] truncate font-mono text-xs text-secondary-600"
            }
          >
            {destination.walletAddress}
          </code>
          <CopyButton
            value={destination.walletAddress}
            label="Copy wallet address"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-secondary-700">
        {destination.bankName}
      </p>
      <p className="truncate text-xs text-secondary-600">
        {destination.accountName}
      </p>
      <div className="flex items-center gap-1">
        <code className="font-mono text-xs text-secondary-600">
          {destination.accountNumber}
        </code>
        <CopyButton
          value={destination.accountNumber}
          label="Copy account number"
        />
      </div>
      {expanded && (destination.routingNumber || destination.swiftCode) && (
        <p className="mt-1 text-xs text-secondary-500">
          {destination.routingNumber && `Routing ${destination.routingNumber}`}
          {destination.routingNumber && destination.swiftCode && " · "}
          {destination.swiftCode && `SWIFT ${destination.swiftCode}`}
        </p>
      )}
    </div>
  )
}
