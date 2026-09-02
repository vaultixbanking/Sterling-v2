"use client"

import { useState } from "react"
import { KeyRound, ShieldAlert } from "lucide-react"

import { CopyButton } from "@/components/ui/copy-button"
import * as api from "@/lib/api/endpoints"
import type { PinShare } from "@/lib/api/types"
import { formatDateTime } from "@/lib/format"
import { company } from "@/lib/site"

/**
 * The recipient's side of a one-time PIN link.
 *
 * Revealing is an explicit tap rather than something that happens on load, and
 * that is not a UX preference — the link travels through WhatsApp, whose
 * crawler fetches every URL it is sent. A page that revealed on render would be
 * spent by that crawler before the person it was meant for ever opened it.
 */
export function PinReveal({
  token,
  initial,
}: {
  token: string
  initial: PinShare
}) {
  const [state, setState] = useState<PinShare["state"]>(initial.state)
  const [pin, setPin] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reveal() {
    setBusy(true)
    setError(null)
    try {
      const result = await api.pinLinks.reveal(token)
      setPin(result.pin)
      setState("REVEALED")
    } catch {
      setError("This link has already been used or has expired.")
      setState("REVEALED")
    } finally {
      setBusy(false)
    }
  }

  const first = initial.fullName.split(" ")[0] ?? "there"

  return (
    <main className="grid min-h-screen place-items-center bg-secondary-100 px-4 py-10">
      <div className="w-full max-w-[440px]">
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-secondary-200/70">
          <header className="border-b border-secondary-200/70 px-7 py-6">
            <p className="font-display text-lg font-bold tracking-tight text-secondary-900">
              {company.name}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold tracking-[0.14em] text-amber-600 uppercase">
              Withdrawal PIN
            </p>
          </header>

          <div className="px-7 py-7">
            {pin ? (
              <>
                <p className="text-sm text-secondary-600">
                  Hi {first}, here is your PIN. It will not be shown again.
                </p>
                <div className="mt-4 rounded-xl border-2 border-amber-200 bg-amber-50 p-5 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-mono text-3xl font-bold tracking-[0.3em] text-secondary-900">
                      {pin}
                    </span>
                    <CopyButton value={pin} label="Copy your PIN" />
                  </div>
                </div>
                <p className="mt-4 text-xs leading-relaxed text-secondary-500">
                  Enter it on the withdrawal page to confirm your request. It can
                  only be used once.
                </p>
              </>
            ) : state === "READY" ? (
              <>
                <p className="text-sm text-secondary-600">
                  Hi {first}, a withdrawal PIN is waiting for you.
                </p>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-secondary-500">Expires</dt>
                    <dd className="font-medium text-secondary-900">
                      {formatDateTime(initial.expiresAt)}
                    </dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() => void reveal()}
                  disabled={busy}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 focus-visible:ring-4 focus-visible:ring-primary-200 focus-visible:outline-none disabled:opacity-60"
                >
                  <KeyRound className="size-4" />
                  {busy ? "Revealing…" : "Reveal my PIN"}
                </button>
                <p className="mt-3 text-center text-xs text-secondary-500">
                  Shows once, then this link stops working.
                </p>
              </>
            ) : (
              <div className="py-4 text-center">
                <ShieldAlert className="mx-auto size-8 text-secondary-400" />
                <p className="mt-3 text-sm font-medium text-secondary-900">
                  {state === "EXPIRED"
                    ? "This link has expired"
                    : "This link has already been used"}
                </p>
                <p className="mt-1 text-sm text-secondary-500">
                  {error ??
                    "Ask your account manager to issue a new PIN for you."}
                </p>
              </div>
            )}
          </div>

          <footer className="border-t border-secondary-200/70 bg-secondary-50 px-7 py-5">
            <p className="text-xs leading-relaxed text-secondary-500">
              Never send this PIN to anyone. We may send a PIN to you, but nobody
              from {company.name} will ever ask you to send one back, read it
              out, or forward it. If someone asks, it is not us.
            </p>
          </footer>
        </div>
      </div>
    </main>
  )
}
