import { cn } from "@/lib/utils"

interface SectionHeadingProps {
  title: React.ReactNode
  description?: React.ReactNode
  align?: "left" | "center"
  className?: string
  titleClassName?: string
  /** Use on dark backgrounds */
  invert?: boolean
}

export function SectionHeading({
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
      <h2
        className={cn(
          "text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-[2.5rem] lg:leading-[1.12]",
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
