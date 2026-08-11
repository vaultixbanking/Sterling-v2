"use client"

import { useState } from "react"

import { DataTable, type Column } from "@/components/app/data-table"
import { PageHeader } from "@/components/app/page-header"
import * as api from "@/lib/api/endpoints"
import type { AuditLogEntry } from "@/lib/api/types"
import { formatDateTime, humanise } from "@/lib/format"
import { useAsyncData } from "@/lib/use-async-data"

/**
 * The audit trail.
 *
 * New in this build — SwiftEdge recorded nothing, so there was no way to tell
 * who credited an account, when a PIN was issued, or which admin approved a
 * withdrawal.
 */
export function AdminAuditLogsScreen() {
  const [page, setPage] = useState(1)

  const result = useAsyncData(
    () => api.admin.auditLogs({ page, limit: 25 }),
    `admin-audit:${page}`
  )

  const columns: Column<AuditLogEntry>[] = [
    {
      key: "action",
      header: "Action",
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-secondary-900">
            {humanise(row.action)}
          </p>
          <p className="text-xs text-secondary-500 lg:hidden">
            {formatDateTime(row.createdAt)}
          </p>
        </div>
      ),
    },
    {
      key: "actor",
      header: "By",
      cell: (row) => (
        <span className="text-secondary-700">
          {row.actor?.username ?? (
            <span className="text-secondary-400">system</span>
          )}
        </span>
      ),
    },
    {
      key: "target",
      header: "Target",
      hideBelow: "md",
      cell: (row) => (
        <span className="text-secondary-600">
          {row.targetType ? (
            <>
              {humanise(row.targetType)}
              {row.targetId && (
                <span className="ml-1 font-mono text-xs text-secondary-400">
                  {row.targetId.slice(-8)}
                </span>
              )}
            </>
          ) : (
            "—"
          )}
        </span>
      ),
    },
    {
      key: "ip",
      header: "IP",
      hideBelow: "lg",
      cell: (row) => (
        <span className="font-mono text-xs text-secondary-500">
          {row.ip ?? "—"}
        </span>
      ),
    },
    {
      key: "when",
      header: "When",
      hideBelow: "lg",
      className: "text-right",
      cell: (row) => (
        <span className="whitespace-nowrap text-secondary-600 tabular">
          {formatDateTime(row.createdAt)}
        </span>
      ),
    },
  ]

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        title="Audit log"
        description="Every administrative action, in order, with who did it."
      />

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
          title: "Nothing logged yet",
          description: "Administrative actions will be recorded here as they happen.",
        }}
      />
    </div>
  )
}
