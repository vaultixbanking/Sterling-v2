import { cn } from "@/lib/utils"

interface SectionHeadingProps {
  eyebrow?: string
  title: React.ReactNode
  description?: React.ReactNode
  align?: "left" | "center"
  className?: string
  titleClassName?: string
  /** Use on dark backgrounds */
  invert?: boolean
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className,
  titleClassName,
  invert = false,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "mx-auto max-w-2xl items-center text-center",
        className
      )}
    >
      {eyebrow && (
        <span
          className={cn(
            "inline-flex items-center gap-2 text-xs font-semibold tracking-[0.18em] uppercase",
            invert ? "text-primary-300" : "text-primary-600"
          )}
        >
          <span
            className={cn(
              "h-px w-6",
              invert ? "bg-primary-300/50" : "bg-primary-600/50"
            )}
          />
          {eyebrow}
        </span>
      )}
      <h2
        className={cn(
          "text-3xl font-bold tracking-tight text-balance sm:text-4xl",
          invert ? "text-white" : "text-secondary-900",
          titleClassName
        )}
      >
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "max-w-2xl text-base leading-relaxed text-pretty sm:text-lg",
            invert ? "text-white/70" : "text-secondary-600"
          )}
        >
          {description}
        </p>
      )}
    </div>
  )
}
