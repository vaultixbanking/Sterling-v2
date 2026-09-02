"use client"

import { CountrySelect } from "@/components/ui/country-select"
import { cn } from "@/lib/utils"

/**
 * Phone number with a dialling-code picker attached.
 *
 * The country is a separate value rather than something parsed back out of the
 * text, because a half-typed number has no country and guessing one mid-keystroke
 * makes the field fight the person using it. The picker owns the code; the input
 * owns the digits.
 */
export function PhoneInput({
  id,
  label,
  country,
  onCountryChange,
  value,
  onChange,
  error,
  valid,
  hint,
  disabled,
}: {
  id: string
  label: string
  country: string
  onCountryChange: (code: string) => void
  value: string
  onChange: (value: string) => void
  error?: string
  valid?: boolean
  hint?: string
  disabled?: boolean
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium text-secondary-700"
      >
        {label}
      </label>

      <div
        className={cn(
          "flex h-13 items-stretch overflow-hidden rounded-xl border-2 bg-white transition-colors focus-within:ring-4",
          error
            ? "border-red-300 focus-within:border-red-500 focus-within:ring-red-100"
            : valid
              ? "border-emerald-300 focus-within:border-primary-500 focus-within:ring-primary-100"
              : "border-secondary-200 focus-within:border-primary-500 focus-within:ring-primary-100"
        )}
      >
        <CountrySelect
          id={`${id}-country`}
          value={country}
          onChange={onCountryChange}
          variant="dial"
          disabled={disabled}
        />

        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="801 234 5678"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className="w-full bg-transparent px-3.5 text-sm outline-none placeholder:text-secondary-400 disabled:opacity-60"
        />
      </div>

      {error ? (
        <p id={`${id}-error`} className="mt-2 text-xs text-red-600">
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
