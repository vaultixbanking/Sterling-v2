"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Copy } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Copies a value and confirms inline.
 *
 * SwiftEdge defined `copyToClipboard` twice; the surviving one used the
 * deprecated `document.execCommand` against `disabled` inputs (where `.select()`
 * is unreliable) and confirmed with a native `alert()`. This uses the Clipboard
 * API with a legacy fallback, and says so in place.
 */
export function CopyButton({
  value,
  label = "Copy",
  className,
  variant = "icon",
}: {
  value: string
  /** Accessible name — say what is being copied, e.g. "Copy wallet address". */
  label?: string
  className?: string
  /**
   * `block` is a full-width labelled button. It exists for the one-time PIN
   * page, where the whole point is that nobody should have to memorise the
   * number — an icon beside it is easy to miss on a phone, and the people most
   * likely to miss it are the ones least likely to go hunting.
   */
  variant?: "icon" | "inline" | "block"
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // Clipboard API needs a secure context; plain http:// on a LAN address
      // is not one, so keep a fallback rather than failing silently.
      const field = document.createElement("textarea")
      field.value = value
      field.setAttribute("readonly", "")
      field.style.position = "fixed"
      field.style.opacity = "0"
      document.body.appendChild(field)
      field.select()
      document.execCommand("copy")
      document.body.removeChild(field)
    }

    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1800)
  }

  const Icon = copied ? Check : Copy

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : label}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-lg font-medium transition-colors",
        "focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none",
        variant === "block"
          ? cn(
              "w-full justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold",
              copied
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                : "bg-primary-600 text-white shadow-sm hover:bg-primary-700"
            )
          : cn(
              copied
                ? "text-emerald-600"
                : "text-secondary-400 hover:text-primary-600",
              variant === "icon" ? "p-1.5" : "px-2 py-1 text-xs"
            ),
        className
      )}
    >
      <Icon className="size-4" />
      {variant === "inline" && <span>{copied ? "Copied" : "Copy"}</span>}
      {variant === "block" && <span>{copied ? "Copied" : label}</span>}
      {variant === "icon" && (
        <span aria-live="polite" className="sr-only">
          {copied ? "Copied to clipboard" : ""}
        </span>
      )}
    </button>
  )
}
