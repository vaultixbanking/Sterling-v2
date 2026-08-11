"use client"

import { useId, useRef } from "react"

import { cn } from "@/lib/utils"

/**
 * Digit-box entry for the withdrawal PIN.
 *
 * SwiftEdge's on-screen keypad had digits and a "clear" — and no backspace, so
 * one mistyped digit meant starting over. This is a real input: type, paste,
 * arrow around, and backspace a single character.
 *
 * Masked by default. The value is held by the parent and never logged.
 */
export function PinInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  autoFocus = false,
  label = "Withdrawal PIN",
  error,
  className,
}: {
  value: string
  onChange: (value: string) => void
  /** The API issues 4- and 6-digit PINs. */
  length?: 4 | 6
  disabled?: boolean
  autoFocus?: boolean
  label?: string
  error?: string
  className?: string
}) {
  const groupId = useId()
  const inputs = useRef<Array<HTMLInputElement | null>>([])

  const digits = value.padEnd(length, " ").slice(0, length).split("")

  function focusAt(index: number) {
    const target = inputs.current[Math.min(Math.max(index, 0), length - 1)]
    target?.focus()
    target?.select()
  }

  function setDigit(index: number, digit: string) {
    const next = digits.map((d) => (d === " " ? "" : d))
    next[index] = digit
    onChange(next.join("").slice(0, length))
  }

  function handleChange(index: number, raw: string) {
    // A phone keyboard can deliver several characters at once, and some
    // password managers fill the whole PIN into the first box.
    const cleaned = raw.replace(/\D/g, "")
    if (cleaned.length === 0) return

    if (cleaned.length > 1) {
      const merged = (value.slice(0, index) + cleaned).slice(0, length)
      onChange(merged)
      focusAt(merged.length)
      return
    }

    setDigit(index, cleaned)
    if (index < length - 1) focusAt(index + 1)
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent) {
    if (event.key === "Backspace") {
      event.preventDefault()
      if (digits[index] && digits[index] !== " ") {
        // Clear this box but stay put, so a correction is one keystroke.
        setDigit(index, "")
      } else if (index > 0) {
        setDigit(index - 1, "")
        focusAt(index - 1)
      }
      return
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault()
      focusAt(index - 1)
    }

    if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault()
      focusAt(index + 1)
    }
  }

  function handlePaste(event: React.ClipboardEvent) {
    event.preventDefault()
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "")
    if (!pasted) return
    const merged = pasted.slice(0, length)
    onChange(merged)
    focusAt(merged.length)
  }

  return (
    <div className={className}>
      <span
        id={`${groupId}-label`}
        className="mb-2 block text-sm font-medium text-secondary-700"
      >
        {label}
      </span>

      <div
        role="group"
        aria-labelledby={`${groupId}-label`}
        aria-describedby={error ? `${groupId}-error` : undefined}
        className="flex gap-2"
      >
        {Array.from({ length }, (_, index) => (
          <input
            key={index}
            ref={(node) => {
              inputs.current[index] = node
            }}
            // `password` so the browser does the masking natively. Rendering a
            // bullet as the value instead would fight `maxLength`: the box
            // would already be full, and typing a replacement digit would be
            // silently dropped.
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={1}
            disabled={disabled}
            autoFocus={autoFocus && index === 0}
            aria-label={`Digit ${index + 1} of ${length}`}
            value={digits[index] === " " ? "" : digits[index]}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={handlePaste}
            onFocus={(event) => event.target.select()}
            className={cn(
              "h-12 w-full min-w-0 rounded-xl border-2 bg-white text-center text-lg font-bold text-secondary-900 transition-colors outline-none",
              "focus:border-primary-500 focus:ring-4 focus:ring-primary-100",
              "disabled:bg-secondary-50 disabled:text-secondary-400",
              error ? "border-red-400" : "border-secondary-200"
            )}
          />
        ))}
      </div>

      {error && (
        <p id={`${groupId}-error`} className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
