"use client"

import { Printer } from "lucide-react"

/**
 * The only interactive part of the receipt, so it is the only part that needs
 * to be a Client Component. Everything else renders on the server — a document
 * someone forwards as proof should not depend on JavaScript running.
 *
 * There is no PDF library behind this: every browser's print dialog offers
 * "Save as PDF", which produces a better file than a server-side renderer
 * would and costs nothing to maintain.
 */
export function PrintReceiptButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 focus-visible:ring-4 focus-visible:ring-primary-200 focus-visible:outline-none print:hidden"
    >
      <Printer className="size-4" />
      Print / Save as PDF
    </button>
  )
}
