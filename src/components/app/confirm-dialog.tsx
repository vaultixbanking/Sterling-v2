"use client"

import { AlertDialog } from "radix-ui"
import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * The confirmation step for anything irreversible.
 *
 * Every destructive action in the app goes through this rather than
 * `window.confirm`, which SwiftEdge used — it cannot be styled, cannot show the
 * figures being confirmed, and blocks the whole tab while it is open.
 *
 * Built on Radix's AlertDialog so focus is trapped, Escape cancels, and the
 * confirm button is focused on open.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  busy = false,
  tone = "default",
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  /** Keeps the dialog open and the button disabled while the request runs. */
  busy?: boolean
  tone?: "default" | "danger"
  /** Extra detail — the figures being confirmed, a PIN field, a warning. */
  children?: React.ReactNode
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-secondary-900/50 backdrop-blur-sm" />
        <AlertDialog.Content
          className="fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-secondary-200 bg-white p-6 shadow-2xl outline-none"
          onEscapeKeyDown={(event) => {
            // Escaping mid-request would leave the user unsure whether it ran.
            if (busy) event.preventDefault()
          }}
        >
          <div className="flex items-start gap-3">
            {tone === "danger" && (
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
                <AlertTriangle className="size-5" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <AlertDialog.Title className="font-heading text-lg font-bold text-secondary-900">
                {title}
              </AlertDialog.Title>
              {description && (
                <AlertDialog.Description asChild>
                  <div className="mt-1.5 text-sm leading-relaxed text-secondary-600">
                    {description}
                  </div>
                </AlertDialog.Description>
              )}
            </div>
          </div>

          {children && <div className="mt-4">{children}</div>}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost" disabled={busy}>
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <Button
              onClick={onConfirm}
              disabled={busy}
              className={cn(
                tone === "danger" &&
                  "bg-red-600 shadow-red-600/20 hover:bg-red-700"
              )}
            >
              {busy ? "Working…" : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
