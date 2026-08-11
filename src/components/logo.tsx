import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  /** Render the wordmark alongside the mark */
  showWordmark?: boolean
  /** Light treatment for dark backgrounds */
  invert?: boolean
}

/**
 * The Sterling Edge mark: a rounded tile carrying a rising trend line.
 * Inline rather than an <img> so the wordmark can inherit its surroundings.
 */
export function Logo({
  className,
  showWordmark = true,
  invert = false,
}: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 512 512"
        className="size-9 shrink-0"
        role="img"
        aria-label="Sterling Edge Trade"
      >
        <defs>
          <linearGradient id="se-logo-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3b82f6" />
            <stop offset="1" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>
        <rect width="512" height="512" rx="116" fill="url(#se-logo-grad)" />
        <path
          d="M104 348 L200 252 L280 332 L400 188"
          fill="none"
          stroke="#ffffff"
          strokeWidth="42"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M326 188 L400 188 L400 262"
          fill="none"
          stroke="#ffffff"
          strokeWidth="42"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              "font-heading text-lg font-bold tracking-tight",
              invert ? "text-white" : "text-secondary-900"
            )}
          >
            Sterling Edge
          </span>
          <span
            className={cn(
              "mt-0.5 text-[10px] font-semibold tracking-[0.28em]",
              invert ? "text-primary-300" : "text-primary-600"
            )}
          >
            TRADE
          </span>
        </span>
      )}
    </span>
  )
}
