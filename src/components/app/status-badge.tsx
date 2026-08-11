import { cva, type VariantProps } from "class-variance-authority"

import { humanise } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * One badge for every status the API can return — transaction, deposit request,
 * withdrawal request, subscription, and account status all share a vocabulary.
 *
 * Mapping the tone here rather than at each call site means a PENDING deposit
 * and a PENDING withdrawal cannot end up different colours on adjacent screens.
 */

const statusBadge = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      tone: {
        pending: "border-amber-200 bg-amber-50 text-amber-700",
        success: "border-emerald-200 bg-emerald-50 text-emerald-700",
        danger: "border-red-200 bg-red-50 text-red-700",
        neutral: "border-secondary-200 bg-secondary-50 text-secondary-600",
        info: "border-primary-200 bg-primary-50 text-primary-700",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
)

type Tone = NonNullable<VariantProps<typeof statusBadge>["tone"]>

const TONES: Record<string, Tone> = {
  PENDING: "pending",
  PROCESSING: "pending",
  COMPLETED: "success",
  APPROVED: "success",
  ACTIVE: "success",
  REJECTED: "danger",
  FAILED: "danger",
  SUSPENDED: "danger",
  CANCELLED: "neutral",
  EXPIRED: "neutral",
  REVOKED: "neutral",
  MATURED: "info",
}

export function StatusBadge({
  status,
  className,
}: {
  status: string | null | undefined
  className?: string
}) {
  const key = (status ?? "").toUpperCase()
  return (
    <span className={cn(statusBadge({ tone: TONES[key] ?? "neutral" }), className)}>
      {humanise(status)}
    </span>
  )
}
