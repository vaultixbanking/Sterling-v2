import { cn } from "@/lib/utils"

/** Title, optional supporting line, and a slot for page-level actions. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="font-heading text-2xl font-bold tracking-tight text-secondary-900">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-secondary-600">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}
