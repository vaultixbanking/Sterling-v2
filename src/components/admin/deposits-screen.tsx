"use client"

import { useState } from "react"
import Link from "next/link"
import { ExternalLink, FileText } from "lucide-react"

import { DataTable, type Column } from "@/components/app/data-table"
import { Money } from "@/components/app/money"
import { PageHeader } from "@/components/app/page-header"
import { StatusBadge } from "@/components/app/status-badge"
import { ReviewDialog } from "@/components/admin/review-dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import * as api from "@/lib/api/endpoints"
import type { AdminDepositRow, RequestStatus } from "@/lib/api/types"
import { formatDateTime, humanise } from "@/lib/format"
import { useAsyncData } from "@/lib/use-async-data"

const STATUSES: Array<{ value: RequestStatus | ""; label: string }> = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "", label: "All" },
]

/** The deposit queue: confirm the money arrived, then credit or refuse. */
export function AdminDepositsScreen() {
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<RequestStatus | "">("PENDING")
  const [review, setReview] = useState<{
    row: AdminDepositRow
    action: "approve" | "reject"
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [proofBusy, setProofBusy] = useState<string | null>(null)

  const result = useAsyncData(
    () =>
      api.admin.deposits({ page, limit: 20, ...(status ? { status } : {}) }),
    `admin-deposits:${page}:${status}`
  )

  /**
   * Proof lives in a private bucket; the API mints a short-lived signed URL on
   * demand rather than the file ever being publicly addressable.
   */
  async function openProof(row: AdminDepositRow) {
    setProofBusy(row.id)
    try {
      const { url } = await api.admin.depositProof(row.id)
      window.open(url, "_blank", "noopener,noreferrer")
    } catch (cause) {
      toast.fromError(cause, "Could not open the proof file.")
    } finally {
      setProofBusy(null)
    }
  }

  async function submit(note: string) {
    if (!review) return
    setBusy(true)
    try {
      await api.admin.processDeposit(review.row.id, review.action, note || undefined)
      toast.success(
        review.action === "approve" ? "Deposit approved" : "Deposit rejected",
        review.action === "approve"
          ? "The user's balance has been credited."
          : "The user can see your note on their request."
      )
      setReview(null)
      result.reload()
    } catch (cause) {
      toast.fromError(cause, "Could not process that deposit.")
    } finally {
      setBusy(false)
    }
  }

  const columns: Column<AdminDepositRow>[] = [
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
            {humanise(row.method)}
          </span>
        </div>
      ),
    },
    {
      key: "reference",
      header: "Reference",
      hideBelow: "lg",
      cell: (row) => (
        <span className="text-secondary-600">{row.reference ?? "—"}</span>
      ),
    },
    {
      key: "proof",
      header: "Proof",
      hideBelow: "md",
      cell: (row) =>
        row.hasProof ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={proofBusy === row.id}
            onClick={() => void openProof(row)}
          >
            <FileText className="size-4" />
            {proofBusy === row.id ? "Opening…" : "View"}
            <ExternalLink className="size-3" />
          </Button>
        ) : (
          <span className="text-xs text-secondary-400">None</span>
        ),
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
            <Button
              size="sm"
              onClick={() => setReview({ row, action: "approve" })}
            >
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
        title="Deposits"
        description="Confirm the payment arrived before crediting the account."
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
          title: status === "PENDING" ? "Nothing waiting" : "No deposits here",
          description:
            status === "PENDING"
              ? "New deposit requests will appear here for review."
              : "Try another status filter.",
        }}
      />

      <ReviewDialog
        open={review !== null}
        onOpenChange={(next) => !next && setReview(null)}
        action={review?.action ?? "approve"}
        title={
          review?.action === "approve" ? "Approve this deposit?" : "Reject this deposit?"
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
                <dt className="text-secondary-600">Method</dt>
                <dd className="font-medium">{humanise(review.row.method)}</dd>
              </div>
              {review.action === "approve" && (
                <p className="mt-2 border-t border-secondary-200 pt-2 text-xs text-secondary-600">
                  This credits the user&apos;s balance immediately.
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
