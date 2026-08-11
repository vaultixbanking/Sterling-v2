import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const cardVariants = cva("relative transition-all duration-300", {
  variants: {
    variant: {
      /** Marketing card: lifts and deepens its shadow on hover */
      default:
        "group rounded-2xl border border-secondary-100/60 bg-white p-6 shadow-md hover:-translate-y-2 hover:border-primary-200 hover:shadow-2xl sm:p-8",
      /** Static panel — no lift, for dense or data-bearing content */
      flat: "rounded-2xl border border-secondary-100/60 bg-white p-6 shadow-sm sm:p-8",
      /** Glassmorphic, for use over the dark section band */
      glass:
        "group rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-md hover:-translate-y-1 hover:bg-white/15 sm:p-8",
      /** Highlighted pricing tier */
      featured:
        "group rounded-2xl border-2 border-primary-600 bg-white p-6 shadow-xl shadow-primary-600/10 hover:-translate-y-2 hover:shadow-2xl sm:p-8",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

function Card({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ variant, className }))}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn(
        "text-lg font-bold text-secondary-900 sm:text-xl",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-sm leading-relaxed text-secondary-600", className)}
      {...props}
    />
  )
}

export { Card, CardTitle, CardDescription, cardVariants }
