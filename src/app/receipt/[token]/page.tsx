import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PrintReceiptButton } from "@/components/receipt/print-button"
import type { PublicReceipt } from "@/lib/api/types"
import { formatDate, formatDateTime, formatMoney } from "@/lib/format"
import { company } from "@/lib/site"

/**
 * A receipt is a document, not a screen. It must never be indexed — the URL is
 * the only thing protecting it — and it renders entirely on the server so that
 * forwarding the link to an accountant or a bank produces something readable
 * without JavaScript.
 */
export const metadata: Metadata = {
  title: "Receipt",
  description: "Transaction receipt.",
  robots: { index: false, follow: false, nocache: true },
}

/**
 * Fetched with a plain `fetch` rather than the shared API client: that client
 * keeps an access token in a module closure, which is correct in a browser and
 * wrong on a server where the module is shared across every visitor.
 */
async function loadReceipt(token: string): Promise<PublicReceipt | null> {
  const base = (
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"
  ).replace(/\/$/, "")

  try {
    const response = await fetch(
      `${base}/receipts/${encodeURIComponent(token)}`,
      { cache: "no-store" }
    )
    if (!response.ok) return null
    const body = (await response.json()) as {
      data?: { receipt?: PublicReceipt }
    }
    return body.data?.receipt ?? null
  } catch {
    return null
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-secondary-200/70 py-3 last:border-0">
      <dt className="text-sm text-secondary-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-secondary-900">
        {value}
      </dd>
    </div>
  )
}

const CATEGORY_LABEL: Record<string, string> = {
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  PROFIT: "Profit",
  PLAN_PAYOUT: "Plan payout",
  HOLDING: "Holding",
  ADJUSTMENT: "Adjustment",
}

/** `params` is a promise in this version of Next — it must be awaited. */
export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const receipt = await loadReceipt(token)

  // An unknown, revoked or malformed token is a 404 rather than an error page:
  // it should be indistinguishable from a receipt that never existed.
  if (!receipt) notFound()

  const credited = receipt.direction === "CREDIT"

  return (
    <main className="min-h-screen bg-secondary-100 px-4 py-10 print:bg-white print:p-0">
      <div className="mx-auto max-w-[640px]">
        <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-secondary-200/70 print:rounded-none print:shadow-none print:ring-0">
          <header className="flex items-start justify-between gap-4 border-b border-secondary-200/70 px-8 py-7">
            <div>
              <p className="font-display text-lg font-bold tracking-tight text-secondary-900">
                {company.name}
              </p>
              <p className="mt-0.5 text-xs text-secondary-500">
                {company.addressParts.street}, {company.addressParts.locality}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-secondary-500 uppercase">
                Receipt
              </p>
              <p className="mt-1 font-mono text-sm font-semibold text-secondary-900">
                {receipt.reference}
              </p>
            </div>
          </header>

          <div className="px-8 py-8">
            <p className="text-sm text-secondary-500">
              {credited ? "Amount credited" : "Amount debited"}
            </p>
            <p
              className={`mt-1 font-display text-4xl font-bold tracking-tight tabular-nums ${
                credited ? "text-emerald-600" : "text-secondary-900"
              }`}
            >
              {credited ? "+" : "−"}
              {formatMoney(receipt.amount)}
            </p>

            <dl className="mt-7">
              <Row label="Account name" value={receipt.account.name} />
              <Row label="Account reference" value={receipt.account.uid} />
              <Row label="Date" value={formatDate(receipt.date)} />
              <Row
                label="Type"
                value={CATEGORY_LABEL[receipt.category] ?? receipt.category}
              />
              {receipt.description ? (
                <Row label="Details" value={receipt.description} />
              ) : null}
              <Row
                label="Status"
                value={
                  receipt.status.charAt(0) +
                  receipt.status.slice(1).toLowerCase()
                }
              />
            </dl>
          </div>

          <footer className="border-t border-secondary-200/70 bg-secondary-50 px-8 py-5 print:bg-white">
            <p className="text-xs leading-relaxed text-secondary-500">
              Issued {formatDateTime(receipt.issuedAt)}. This receipt confirms
              the transaction above has been completed and applied to the named
              account. Questions about it can be sent to {company.email}.
            </p>
          </footer>
        </article>

        <div className="mt-6 flex justify-center print:hidden">
          <PrintReceiptButton />
        </div>
      </div>
    </main>
  )
}
