"use client"

import { useAuth } from "@/components/providers/auth-provider"
import { CopyButton } from "@/components/ui/copy-button"
import { cn } from "@/lib/utils"

/**
 * The account reference, wherever someone is likely to be asked for it.
 *
 * One component rather than the same markup on three screens: it appears
 * directly under the page heading on each, and three hand-copied versions would
 * drift the moment one of them was adjusted.
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
        "mb-5 inline-flex items-center gap-2.5 rounded-xl border border-secondary-200/70 bg-white py-2 pr-2 pl-3.5 shadow-sm",
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
