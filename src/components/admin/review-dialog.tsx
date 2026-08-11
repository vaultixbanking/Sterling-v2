"use client"

import { useState } from "react"
import { AlertDialog } from "radix-ui"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Approve or reject a queued request, with a note.
 *
 * The note is optional on approval and strongly encouraged on rejection — it is
 * the only explanation the user ever sees on their own request list, so
 * rejecting without one leaves them with a red badge and no reason.
 */
export function ReviewDialog({
  open,
  onOpenChange,
  action,
  title,
  summary,
  busy,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  action: "approve" | "reject"
  title: string
  summary?: React.ReactNode
  busy: boolean
  onSubmit: (note: string) => void
}) {
  const [note, setNote] = useState("")
  const rejecting = action === "reject"

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (busy) return
        if (!next) setNote("")
        onOpenChange(next)
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-secondary-900/50 backdrop-blur-sm" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-secondary-200 bg-white p-6 shadow-2xl outline-none">
          <AlertDialog.Title className="font-heading text-lg font-bold text-secondary-900">
            {title}
          </AlertDialog.Title>

          {summary && (
            <AlertDialog.Description asChild>
              <div className="mt-3 rounded-xl bg-secondary-50 p-4 text-sm">
                {summary}
              </div>
            </AlertDialog.Description>
          )}

          <div className="mt-4">
            <label
              htmlFor="review-note"
              className="mb-2 block text-sm font-medium text-secondary-700"
            >
              Note
              <span className="ml-1.5 text-xs font-normal text-secondary-400">
                {rejecting ? "shown to the user" : "optional"}
              </span>
            </label>
            <textarea
              id="review-note"
              rows={3}
              value={note}
              disabled={busy}
              onChange={(event) => setNote(event.target.value)}
              placeholder={
                rejecting
                  ? "Why is this being rejected?"
                  : "Anything to record against this decision"
              }
              className="w-full rounded-xl border-2 border-secondary-200 px-3.5 py-2.5 text-sm transition-colors outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100 disabled:bg-secondary-50"
            />
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost" disabled={busy}>
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <Button
              disabled={busy}
              onClick={() => onSubmit(note.trim())}
              className={cn(
                rejecting && "bg-red-600 shadow-red-600/20 hover:bg-red-700"
              )}
            >
              {busy ? "Working…" : rejecting ? "Reject" : "Approve"}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
