"use client"

import * as React from "react"
import { AlertCircle, Check } from "lucide-react"

import { cn } from "@/lib/utils"

interface CheckboxProps extends Omit<React.ComponentProps<"input">, "type"> {
  id: string
  error?: string
}

/**
 * Native checkbox kept for form semantics, visually replaced by a styled box so
 * the check mark can pick up the brand blue.
 */
export function Checkbox({
  id,
  error,
  className,
  children,
  ...props
}: CheckboxProps) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="relative mt-0.5 flex size-5 shrink-0 items-center justify-center">
          <input
            id={id}
            type="checkbox"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className={cn(
              "peer size-5 cursor-pointer appearance-none rounded-md border transition-all outline-none",
              "checked:border-primary-600 checked:bg-primary-600",
              "focus-visible:ring-4 focus-visible:ring-primary-100",
              error
                ? "border-red-300 bg-red-50"
                : "border-secondary-300 hover:border-primary-400",
              className
            )}
            {...props}
          />
          <Check
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100"
            strokeWidth={3}
          />
        </span>

        <label
          htmlFor={id}
          className="cursor-pointer text-sm leading-relaxed text-secondary-600"
        >
          {children}
        </label>
      </div>

      {error && (
        <p
          id={`${id}-error`}
          className="mt-2 flex items-start gap-1.5 text-sm text-red-600"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
