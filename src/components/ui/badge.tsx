import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        /** Eyebrow pill above a section title */
        default:
          "border border-primary-100 bg-primary-50 px-4 py-1.5 text-sm text-primary-700",
        /** Same pill, tuned for tinted backgrounds */
        tinted:
          "border border-primary-200/50 bg-primary-100/60 px-4 py-1.5 text-sm text-primary-700",
        /** For use over dark or photographic backgrounds */
        glass:
          "border border-white/15 bg-white/10 px-4 py-1.5 text-sm text-white/90 backdrop-blur-sm",
        /** Small inline tag */
        tag: "bg-primary-100 px-2.5 py-1 text-xs text-primary-700",
        up: "border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700",
        down: "border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
