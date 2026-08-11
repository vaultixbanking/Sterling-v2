"use client"

import { useState } from "react"
import { X } from "lucide-react"

import { DataTable, type Column } from "@/components/app/data-table"
import { Money } from "@/components/app/money"
import { PageHeader } from "@/components/app/page-header"
import { StatusBadge } from "@/components/app/status-badge"
import { Button } from "@/components/ui/button"
import * as api from "@/lib/api/endpoints"
import type {
  Transaction,
  TxCategory,
  TxStatus,
  TxType,
} from "@/lib/api/types"
import { formatDateTime, humanise } from "@/lib/format"
import { useAsyncData } from "@/lib/use-async-data"
import { cn } from "@/lib/utils"

/**
 * The full ledger, filtered and paged.
 *
 * The filters here are their own state, deliberately unrelated to the
 * dashboard's chart-period buttons. In SwiftEdge both were `.filter-btn` and a
 * single delegated handler ran for either, so changing the chart range also
 * re-filtered the table and vice versa.
 */

const TYPES: Array<{ value: TxType | ""; label: string }> = [
  { value: "", label: "All types" },
  { value: "CREDIT", label: "Credit" },
  { value: "DEBIT", label: "Debit" },
]

const CATEGORIES: Array<{ value: TxCategory | ""; label: string }> = [
  { value: "", label: "All categories" },
  { value: "DEPOSIT", label: "Deposit" },
  { value: "WITHDRAWAL", label: "Withdrawal" },
  { value: "PROFIT", label: "Profit" },
  { value: "HOLDING", label: "Holding" },
  { value: "ADJUSTMENT", label: "Adjustment" },
  { value: "PLAN_PAYOUT", label: "Plan payout" },
]

const STATUSES: Array<{ value: TxStatus | ""; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "COMPLETED", label: "Completed" },
  { value: "PENDING", label: "Pending" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
]

export function TransactionsScreen() {
  const [page, setPage] = useState(1)
  const [type, setType] = useState<TxType | "">("")
  const [category, setCategory] = useState<TxCategory | "">("")
  const [status, setStatus] = useState<TxStatus | "">("")

  const filtered = Boolean(type || category || status)

  const result = useAsyncData(
    () =>
      api.transactions.list({
        page,
        limit: 20,
        ...(type ? { type } : {}),
        ...(category ? { category } : {}),
        ...(status ? { status } : {}),
      }),
    `transactions:${page}:${type}:${category}:${status}`
  )

  /** Any filter change invalidates the current page number. */
  function change<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value)
      setPage(1)
    }
  }

  function clearFilters() {
    setType("")
    setCategory("")
    setStatus("")
    setPage(1)
  }

  const columns: Column<Transaction>[] = [
    {
      key: "description",
      header: "Description",
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-secondary-900">
            {row.description ?? humanise(row.category)}
          </p>
          <p className="text-xs text-secondary-500 md:hidden">
            {formatDateTime(row.createdAt)}
          </p>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      hideBelow: "lg",
      cell: (row) => (
        <span className="whitespace-nowrap text-secondary-600">
          {humanise(row.category)}
        </span>
      ),
    },
    {
      key: "date",
      header: "Date",
      hideBelow: "md",
      cell: (row) => (
        <span className="whitespace-nowrap text-secondary-600 tabular">
          {formatDateTime(row.createdAt)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      hideBelow: "sm",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "amount",
      header: "Amount",
      className: "text-right",
      cell: (row) => (
        <Money
          // Direction lives in `type`; the stored amount is always positive.
          value={row.type === "DEBIT" ? `-${row.amount}` : row.amount}
          signed
          className="font-semibold"
        />
      ),
    },
  ]

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        title="Transactions"
        description="Every credit and debit on your account."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterSelect
          id="filter-type"
          label="Type"
          value={type}
          options={TYPES}
          onChange={change(setType)}
        />
        <FilterSelect
          id="filter-category"
          label="Category"
          value={category}
          options={CATEGORIES}
          onChange={change(setCategory)}
        />
        <FilterSelect
          id="filter-status"
          label="Status"
          value={status}
          options={STATUSES}
          onChange={change(setStatus)}
        />

        {filtered && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="size-4" />
            Clear filters
          </Button>
        )}
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
        empty={
          filtered
            ? {
                title: "Nothing matches those filters",
                description: "Try widening them to see more of your history.",
              }
            : {
                title: "No transactions yet",
                description:
                  "Deposits, profits, and withdrawals appear here as they happen.",
                action: { label: "Make a deposit", href: "/deposit" },
              }
        }
      />
    </div>
  )
}

function FilterSelect<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className={cn(
          "h-10 rounded-lg border bg-white px-3 pr-8 text-sm font-medium transition-colors outline-none",
          "focus-visible:ring-4 focus-visible:ring-primary-200",
          value
            ? "border-primary-300 text-primary-700"
            : "border-secondary-200 text-secondary-700"
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
