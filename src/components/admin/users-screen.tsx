"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"

import { DataTable, type Column } from "@/components/app/data-table"
import { Money } from "@/components/app/money"
import { PageHeader } from "@/components/app/page-header"
import { StatusBadge } from "@/components/app/status-badge"
import * as api from "@/lib/api/endpoints"
import type { AdminUserListItem, UserStatus } from "@/lib/api/types"
import { formatDate, formatRelative } from "@/lib/format"
import { useAsyncData } from "@/lib/use-async-data"

const FILTERS: Array<{ value: UserStatus | ""; label: string }> = [
  { value: "", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
]

/**
 * The user list.
 *
 * SwiftEdge had none — an admin had to already know a UID to do anything, so
 * there was no way to find a user by name or email, and no way to see who had
 * signed up at all.
 */
export function AdminUsersScreen() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<UserStatus | "">("")
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")

  // Debounced so typing a name is one request at the end, not one per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const result = useAsyncData(
    () =>
      api.admin.users({
        page,
        limit: 20,
        ...(debounced ? { search: debounced } : {}),
        ...(status ? { status } : {}),
      }),
    `admin-users:${page}:${debounced}:${status}`
  )

  const columns: Column<AdminUserListItem>[] = [
    {
      key: "user",
      header: "User",
      cell: (row) => (
        <Link href={`/admin/users/${row.uid}`} className="min-w-0 hover:underline">
          <span className="block truncate font-medium text-secondary-900">
            {row.fullName}
          </span>
          <span className="block truncate text-xs text-secondary-500">
            {row.email}
          </span>
        </Link>
      ),
    },
    {
      key: "uid",
      header: "UID",
      hideBelow: "md",
      cell: (row) => (
        <span className="font-mono text-xs text-secondary-600">{row.uid}</span>
      ),
    },
    {
      key: "balance",
      header: "Balance",
      cell: (row) => (
        <div>
          <Money value={row.balance} className="font-semibold" />
          {row.balance !== row.available && (
            <span className="block text-xs text-secondary-500">
              <Money value={row.available} /> available
            </span>
          )}
        </div>
      ),
    },
    {
      key: "lastLogin",
      header: "Last seen",
      hideBelow: "lg",
      cell: (row) => (
        <span className="whitespace-nowrap text-secondary-600">
          {row.lastLoginAt ? formatRelative(row.lastLoginAt) : "Never"}
        </span>
      ),
    },
    {
      key: "joined",
      header: "Joined",
      hideBelow: "lg",
      cell: (row) => (
        <span className="whitespace-nowrap text-secondary-600 tabular">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={row.status} />
          {row.role === "ADMIN" && (
            <span className="rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">
              Admin
            </span>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader title="Users" description="Search, inspect, and manage accounts." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-secondary-400"
          />
          <label htmlFor="user-search" className="sr-only">
            Search users
          </label>
          <input
            id="user-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, email, username, or UID"
            className="h-10 w-full rounded-lg border border-secondary-200 bg-white pr-3 pl-10 text-sm transition-colors outline-none focus-visible:border-primary-500 focus-visible:ring-4 focus-visible:ring-primary-100"
          />
        </div>

        <div className="flex gap-2">
          {FILTERS.map((option) => (
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
          title: debounced ? "No users match that search" : "No users yet",
          description: debounced
            ? "Try a different name, email, or UID."
            : "Accounts will appear here as people sign up.",
        }}
      />
    </div>
  )
}
