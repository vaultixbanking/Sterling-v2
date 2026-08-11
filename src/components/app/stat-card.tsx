import type { LucideIcon } from "lucide-react"

import { Money } from "@/components/app/money"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * A headline figure with its supporting detail.
 *
 * `loading` renders the same box with skeletons rather than collapsing to
 * nothing, so the dashboard does not reflow as each card resolves.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  tone = "neutral",
  loading = false,
  className,
}: {
  label: string
  /** Decimal string from the API. */
  value: string | null | undefined
  icon?: LucideIcon
  /** Smaller figures beneath, e.g. today / yesterday / this week. */
  sub?: Array<{ label: string; value: string | null | undefined; signed?: boolean }>
  tone?: "neutral" | "primary"
  loading?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 shadow-sm",
        tone === "primary"
          ? "border-primary-600 bg-primary-600 text-white"
          : "border-secondary-100/80 bg-white",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            "text-sm font-medium",
            tone === "primary" ? "text-primary-100" : "text-secondary-500"
          )}
        >
          {label}
        </p>
        {Icon && (
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-lg",
              tone === "primary"
                ? "bg-white/15 text-white"
                : "bg-primary-50 text-primary-600"
            )}
          >
            <Icon className="size-4.5" />
          </span>
        )}
      </div>

      <div className="mt-3">
        {loading ? (
          <Skeleton className="h-8 w-36" />
        ) : (
          <p
            className={cn(
              "font-heading text-2xl font-bold tracking-tight tabular sm:text-3xl",
              tone === "primary" ? "text-white" : "text-secondary-900"
            )}
          >
            <Money value={value} />
          </p>
        )}
      </div>

      {sub && sub.length > 0 && (
        <dl
          className={cn(
            "mt-4 grid gap-3 border-t pt-3",
            sub.length > 1 ? "grid-cols-3" : "grid-cols-1",
            tone === "primary" ? "border-white/20" : "border-secondary-100"
          )}
        >
          {sub.map((entry) => (
            <div key={entry.label} className="min-w-0">
              <dt
                className={cn(
                  "truncate text-[11px]",
                  tone === "primary" ? "text-primary-100" : "text-secondary-500"
                )}
              >
                {entry.label}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold">
                {loading ? (
                  <Skeleton className="h-4 w-16" />
                ) : (
                  <Money
                    value={entry.value}
                    signed={entry.signed}
                    compact
                    className={
                      tone === "primary" && !entry.signed ? "text-white" : undefined
                    }
                  />
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
