"use client"

import { ArrowUp } from "lucide-react"

/**
 * Isolated as a client component so the footer itself can stay on the server.
 */
export function ScrollToTop() {
  return (
    <button
      type="button"
      aria-label="Scroll to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="rounded-lg bg-secondary-800 p-2 text-white transition-colors hover:bg-primary-600"
    >
      <ArrowUp className="size-4" />
    </button>
  )
}
