"use client"

import * as React from "react"
import { AlertCircle, Check, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface InputProps extends Omit<React.ComponentProps<"input">, "id"> {
  id: string
  label: string
  /** Leading icon; tints to primary while the field has focus */
  icon?: LucideIcon
  error?: string
  /** Shows a green check once the field passes validation */
  valid?: boolean
  optional?: boolean
  hint?: string
  /** Rendered inside the field, right-aligned — used for the password toggle */
  trailing?: React.ReactNode
}

export function Input({
  id,
  label,
  icon: Icon,
  error,
  valid,
  optional,
  hint,
  trailing,
  className,
  ...props
}: InputProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium text-secondary-700"
      >
        {label}
        {optional ? (
          <span className="ml-1.5 text-xs font-normal text-secondary-400">
            optional
          </span>
        ) : (
          <span className="ml-1 text-primary-600">*</span>
        )}
      </label>

      <div className="group relative">
        {Icon && (
          <Icon
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 transition-colors",
              error
                ? "text-red-400"
                : "text-secondary-400 group-focus-within:text-primary-500"
            )}
          />
        )}

        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-12 w-full rounded-xl border bg-white text-sm text-secondary-900 transition-all outline-none placeholder:text-secondary-400",
            "focus:ring-4 focus:ring-primary-100",
            Icon ? "pl-11" : "pl-4",
            trailing || valid ? "pr-11" : "pr-4",
            error
              ? "border-red-300 bg-red-50/50 focus:border-red-400 focus:ring-red-100"
              : "border-secondary-200 hover:border-primary-300 focus:border-primary-500",
            className
          )}
          {...props}
        />

        <div className="absolute top-1/2 right-3.5 -translate-y-1/2">
          {trailing ?? (valid && <Check className="size-5 text-emerald-500" />)}
        </div>
      </div>

      {error ? (
        <p
          id={`${id}-error`}
          className="mt-2 flex items-start gap-1.5 text-sm text-red-600"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-2 text-xs text-secondary-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** Eye toggle for password fields, passed to Input via `trailing`. */
export function PasswordToggle({
  shown,
  onToggle,
  Icon,
}: {
  shown: boolean
  onToggle: () => void
  Icon: LucideIcon
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? "Hide password" : "Show password"}
      className="rounded-md p-0.5 text-secondary-400 transition-colors hover:text-primary-600 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
    >
      <Icon className="size-5" />
    </button>
  )
}
