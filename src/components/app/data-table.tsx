"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { EmptyState, ErrorState } from "@/components/app/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { PageMeta } from "@/lib/api/types"
import { cn } from "@/lib/utils"

/**
 * The app's one table.
 *
 * It owns all three states itself — skeleton, empty, error-with-retry — because
 * making each page remember to render them is how you end up with SwiftEdge's
 * empty `<tbody>`, which looks exactly like a table whose fetch failed.
 *
 * Wide content scrolls inside its own container so the page body never scrolls
 * horizontally on a phone.
 */

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => React.ReactNode
  /** Applied to both the header cell and every body cell in the column. */
  className?: string
  /** Drop the column below this breakpoint to keep narrow screens readable. */
  hideBelow?: "sm" | "md" | "lg"
}

const HIDE: Record<NonNullable<Column<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading = false,
  error = null,
  onRetry,
  empty,
  meta,
  onPageChange,
  className,
}: {
  columns: Column<T>[]
  rows: T[]
  getRowKey: (row: T) => string
  loading?: boolean
  error?: unknown
  onRetry?: () => void
  empty: { title: string; description?: string; action?: { label: string; href: string } }
  meta?: PageMeta
  onPageChange?: (page: number) => void
  className?: string
}) {
  if (error) {
    return (
      <ErrorState
        description="The list could not be loaded. Your data is safe — this is a display problem."
        onRetry={onRetry}
      />
    )
  }

  // An empty page that is not the first is a stale cursor, not an empty list —
  // showing "nothing here yet" there would be a lie, so keep the pager visible.
  if (!loading && rows.length === 0 && (meta?.page ?? 1) === 1) {
    return <EmptyState {...empty} />
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="overflow-x-auto rounded-2xl border border-secondary-100/80 bg-white shadow-sm">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-secondary-100 bg-secondary-50/60">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "px-4 py-3 text-xs font-semibold tracking-wide text-secondary-500 uppercase",
                    column.hideBelow && HIDE[column.hideBelow],
                    column.className
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-secondary-100">
            {loading
              ? Array.from({ length: 5 }, (_, index) => (
                  <tr key={`skeleton-${index}`}>
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          "px-4 py-3.5",
                          column.hideBelow && HIDE[column.hideBelow]
                        )}
                      >
                        <Skeleton className="h-4 w-full max-w-28" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr
                    key={getRowKey(row)}
                    className="transition-colors hover:bg-secondary-50/60"
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          "px-4 py-3.5 text-secondary-700",
                          column.hideBelow && HIDE[column.hideBelow],
                          column.className
                        )}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {meta && meta.pages > 1 && onPageChange && (
        <Pagination meta={meta} onPageChange={onPageChange} disabled={loading} />
      )}
    </div>
  )
}

function Pagination({
  meta,
  onPageChange,
  disabled,
}: {
  meta: PageMeta
  onPageChange: (page: number) => void
  disabled: boolean
}) {
  const from = (meta.page - 1) * meta.limit + 1
  const to = Math.min(meta.page * meta.limit, meta.total)

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-xs text-secondary-500 tabular">
        Showing {from}–{to} of {meta.total}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>
        <span className="px-1 text-xs text-secondary-500 tabular">
          Page {meta.page} of {meta.pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || meta.page >= meta.pages}
          onClick={() => onPageChange(meta.page + 1)}
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
