"use client"

import { useState } from "react"
import Link from "next/link"
import { KeyRound, Search } from "lucide-react"

import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { EmptyState, ErrorState } from "@/components/app/empty-state"
import { PageHeader } from "@/components/app/page-header"
import { StatusBadge } from "@/components/app/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast"
import * as api from "@/lib/api/endpoints"
import type { AdminPin } from "@/lib/api/types"
import { formatDateTime, formatRelative } from "@/lib/format"
import { useAsyncData } from "@/lib/use-async-data"

/**
 * Issued withdrawal PINs.
 *
 * The PIN values themselves are not here and cannot be — the API stores only a
 * hash, and the plaintext is returned exactly once, to the admin who issued it.
 * This page is for seeing what is outstanding and revoking it.
 */
export function AdminPinsScreen() {
  const toast = useToast()
  const [uid, setUid] = useState("")
  const [query, setQuery] = useState("")
  const [revoking, setRevoking] = useState<AdminPin | null>(null)
  const [busy, setBusy] = useState(false)

  const result = useAsyncData(
    () => api.admin.pins(query || undefined),
    `admin-pins:${query}`
  )

  async function revoke() {
    if (!revoking) return
    setBusy(true)
    try {
      await api.admin.revokePin(revoking.id)
      toast.success("PIN revoked", "It can no longer authorise a withdrawal.")
      setRevoking(null)
      result.reload()
    } catch (cause) {
      toast.fromError(cause, "Could not revoke that PIN.")
    } finally {
      setBusy(false)
    }
  }

  const pins = result.data?.pins ?? []

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Withdrawal PINs"
        description="Outstanding PINs. Values are never stored in readable form — issue a new one from the user's page."
      />

      <form
        className="mb-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          setQuery(uid.trim())
        }}
      >
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-secondary-400"
          />
          <label htmlFor="pin-uid" className="sr-only">
            Filter by UID
          </label>
          <input
            id="pin-uid"
            value={uid}
            onChange={(event) => setUid(event.target.value)}
            placeholder="Filter by UID"
            className="h-10 w-full rounded-lg border border-secondary-200 bg-white pr-3 pl-10 text-sm outline-none focus-visible:border-primary-500 focus-visible:ring-4 focus-visible:ring-primary-100"
          />
        </div>
        <Button type="submit" size="sm">
          Filter
        </Button>
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setUid("")
              setQuery("")
            }}
          >
            Clear
          </Button>
        )}
      </form>

      {result.error && !result.data ? (
        <ErrorState title="Could not load PINs" onRetry={result.reload} />
      ) : result.loading && !result.data ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : pins.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title={query ? "No PINs for that UID" : "No PINs issued"}
          description="Issue one from a user's detail page when they ask to withdraw."
        />
      ) : (
        <ul className="space-y-3">
          {pins.map((pin) => (
            <li
              key={pin.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-secondary-100/80 bg-white p-4 shadow-sm"
            >
              <div className="min-w-0">
                {pin.user ? (
                  <Link
                    href={`/admin/users/${pin.user.uid}`}
                    className="font-semibold text-secondary-900 hover:underline"
                  >
                    {pin.user.fullName}
                  </Link>
                ) : (
                  <span className="font-semibold text-secondary-500">
                    Deleted user
                  </span>
                )}
                <p className="text-xs text-secondary-500 tabular">
                  {pin.user?.uid ?? "—"} · issued{" "}
                  {formatRelative(pin.createdAt)}
                </p>
                <p className="text-xs text-secondary-500">
                  {pin.usedAt
                    ? `Used ${formatDateTime(pin.usedAt)}`
                    : `Expires ${formatDateTime(pin.expiresAt)}`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <StatusBadge status={pin.status} />
                {pin.status === "ACTIVE" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => setRevoking(pin)}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(next) => !busy && !next && setRevoking(null)}
        title="Revoke this PIN?"
        description={
          revoking?.user
            ? `${revoking.user.fullName} will not be able to use it, and will need a new one to withdraw.`
            : "The PIN will stop working immediately."
        }
        confirmLabel="Revoke"
        tone="danger"
        busy={busy}
        onConfirm={() => void revoke()}
      />
    </div>
  )
}
