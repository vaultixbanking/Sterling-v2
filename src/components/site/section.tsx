import { cn } from "@/lib/utils"

interface SectionProps extends React.ComponentProps<"section"> {
  /** Applied to the inner `.container-px` wrapper */
  innerClassName?: string
  /** Render children without the constrained container */
  bleed?: boolean
}

/**
 * Enforces the site-wide vertical rhythm so every section breathes the same.
 */
export function Section({
  className,
  innerClassName,
  bleed = false,
  children,
  ...props
}: SectionProps) {
  return (
    <section
      className={cn("py-16 sm:py-20 lg:py-24", className)}
      {...props}
    >
      {bleed ? (
        children
      ) : (
        <div className={cn("container-px", innerClassName)}>{children}</div>
      )}
    </section>
  )
}
