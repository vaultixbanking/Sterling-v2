"use client"

import { useAuth } from "@/components/providers/auth-provider"
import { CopyButton } from "@/components/ui/copy-button"
import { cn } from "@/lib/utils"

/**
 * The account reference, sized to sit in the dashboard's action row beside
 * Deposit and Withdraw rather than on a line of its own.
 *
 * Renders nothing while the user is still loading, and nothing if there is no
 * uid — an empty chip labelled "Account ID" is worse than no chip, because it
 * reads as a value that failed rather than as one that has not arrived.
 */
export function AccountIdChip({ className }: { className?: string }) {
  const { user } = useAuth()

  if (!user?.uid) return null

  return (
    <div
      className={cn(
        // Height is tuned to sit level with a `size="sm"` Button, because it
        // shares a row with Deposit and Withdraw on the dashboard.
        "inline-flex h-9 items-center gap-2 rounded-lg border border-secondary-200/70 bg-white py-0 pr-1 pl-3 shadow-sm",
        className
      )}
    >
      <span className="text-xs font-medium text-secondary-500">Account ID</span>
      <span className="font-mono text-sm font-semibold tracking-wide text-secondary-900 tabular">
        {user.uid}
      </span>
      <CopyButton value={user.uid} label="Copy your account ID" />
    </div>
  )
}
