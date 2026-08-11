import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-all duration-300 outline-none focus-visible:ring-4 focus-visible:ring-primary-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary-600 text-white shadow-lg shadow-primary-600/20 hover:bg-primary-700 hover:shadow-xl hover:shadow-primary-600/25",
        gradient:
          "bg-linear-to-r from-primary-600 to-primary-700 text-white shadow-lg shadow-primary-600/20 hover:from-primary-700 hover:to-primary-800 hover:shadow-xl",
        outline:
          "border-2 border-primary-600 text-primary-600 hover:bg-primary-50",
        /** For use on dark or photographic backgrounds */
        inverse: "bg-white text-primary-700 shadow-lg hover:bg-primary-50",
        ghostInverse:
          "border border-white/25 text-white backdrop-blur-sm hover:bg-white/10",
        ghost: "text-secondary-700 hover:bg-secondary-100 hover:text-secondary-900",
        link: "text-primary-600 underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        default: "h-11 px-6 text-sm",
        lg: "h-12 px-7 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
