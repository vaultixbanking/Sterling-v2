import { formatMoney, formatMoneyCompact, moneySign } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * A monetary figure.
 *
 * Takes the decimal **string** the API sends and never converts it to a number,
 * so nothing here can round. `signed` colours gains and losses and prefixes a
 * `+`, which is only meaningful for deltas — a balance should stay neutral.
 */
export function Money({
  value,
  signed = false,
  compact = false,
  className,
}: {
  value: string | null | undefined
  signed?: boolean
  compact?: boolean
  className?: string
}) {
  const sign = moneySign(value)
  const text = compact ? formatMoneyCompact(value) : formatMoney(value)

  return (
    <span
      className={cn(
        "tabular",
        signed &&
          (sign > 0
            ? "text-emerald-600"
            : sign < 0
              ? "text-red-600"
              : "text-secondary-500"),
        className
      )}
    >
      {signed && sign > 0 ? "+" : ""}
      {text}
    </span>
  )
}
