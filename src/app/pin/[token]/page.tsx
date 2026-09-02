import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PinReveal } from "@/components/pin/pin-reveal"
import type { PinShare } from "@/lib/api/types"
import { company } from "@/lib/site"

/**
 * The preview a chat app draws for this link.
 *
 * It names the sender and says a PIN is waiting, and stops there — no name, no
 * PIN, nothing that a card sitting in a group chat should be carrying. The
 * generic marketing card would have been worse than useless here: a link that
 * looks like an advert is exactly what a cautious person ignores, and this one
 * needs to be tapped by the person it was sent to.
 */
export const metadata: Metadata = {
  title: "Your withdrawal PIN",
  description: `A withdrawal PIN is waiting for you. Open to view it once.`,
  robots: { index: false, follow: false, nocache: true },
  openGraph: {
    title: "Your withdrawal PIN",
    description: `A withdrawal PIN is waiting for you. Open to view it once.`,
    siteName: company.name,
    type: "article",
  },
}

/**
 * Fetched with a plain `fetch` rather than the shared API client, which keeps an
 * access token in a module closure — correct in a browser, wrong on a server
 * where the module is shared across every visitor.
 *
 * This read never returns the PIN and never spends the link. Revealing is a
 * POST, made from the browser on an explicit tap.
 */
async function loadShare(token: string): Promise<PinShare | null> {
  const base = (
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"
  ).replace(/\/$/, "")

  try {
    const response = await fetch(
      `${base}/pin-links/${encodeURIComponent(token)}`,
      { cache: "no-store" }
    )
    if (!response.ok) return null
    const body = (await response.json()) as { data?: { share?: PinShare } }
    return body.data?.share ?? null
  } catch {
    return null
  }
}

/** `params` is a promise in this version of Next — it must be awaited. */
export default async function PinLinkPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const share = await loadShare(token)

  if (!share) notFound()

  return <PinReveal token={token} initial={share} />
}
