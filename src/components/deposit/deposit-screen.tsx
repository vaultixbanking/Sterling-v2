"use client"

import { useMemo, useRef, useState } from "react"
import {
  Banknote,
  Bitcoin,
  CreditCard,
  FileUp,
  Mail,
  Smartphone,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react"

import { EmptyState, ErrorState } from "@/components/app/empty-state"
import { Money } from "@/components/app/money"
import { PageHeader } from "@/components/app/page-header"
import { StatusBadge } from "@/components/app/status-badge"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/ui/copy-button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast"
import { isApiError } from "@/lib/api/client"
import * as api from "@/lib/api/endpoints"
import type { DepositMethod, DepositMethods } from "@/lib/api/types"
import { formatDate, formatMoney } from "@/lib/format"
import { useAsyncData } from "@/lib/use-async-data"
import { cn } from "@/lib/utils"

/**
 * Request a deposit.
 *
 * In SwiftEdge this page had two file inputs and two submit buttons wired to
 * nothing at all — no endpoint existed to receive them. Everything here posts.
 */

/** Mirrors the server's own limits in `config/constants.ts`. */
const MAX_PROOF_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"]

const METHOD_META: Record<DepositMethod, { label: string; icon: LucideIcon }> = {
  BANK_TRANSFER: { label: "Bank transfer", icon: Banknote },
  CRYPTO: { label: "Crypto", icon: Bitcoin },
  DIGITAL_WALLET: { label: "Digital wallet", icon: Smartphone },
  CARD: { label: "Card", icon: CreditCard },
}

export function DepositScreen() {
  const toast = useToast()
  const methods = useAsyncData(() => api.deposits.methods(), "deposit-methods")
  const history = useAsyncData(() => api.deposits.list(), "deposit-history")

  const [method, setMethod] = useState<DepositMethod>("BANK_TRANSFER")
  const [amount, setAmount] = useState("")
  const [reference, setReference] = useState("")
  const [proof, setProof] = useState<File | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const config = methods.data

  // Only offer what the admin has actually configured. An empty crypto list
  // means there is no wallet to pay into, and showing the option anyway would
  // walk the user into a dead end.
  const available = useMemo<DepositMethod[]>(() => {
    if (!config) return []
    const list: DepositMethod[] = []
    if (config.bank) list.push("BANK_TRANSFER")
    if (config.crypto.length > 0) list.push("CRYPTO")
    if (config.digitalWallets.length > 0) list.push("DIGITAL_WALLET")
    list.push("CARD")
    return list
  }, [config])

  function pickFile(file: File | null) {
    if (!file) {
      setProof(null)
      return
    }

    if (!ALLOWED_MIME.includes(file.type)) {
      setFieldErrors((current) => ({
        ...current,
        proof: "Upload a JPEG, PNG, WebP, or PDF.",
      }))
      return
    }

    if (file.size > MAX_PROOF_BYTES) {
      setFieldErrors((current) => ({
        ...current,
        proof: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.`,
      }))
      return
    }

    setFieldErrors((current) => {
      const next = { ...current }
      delete next.proof
      return next
    })
    setProof(file)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return

    const numeric = Number(amount)
    const minimum = Number(config?.minimumDeposit ?? 0)

    if (!Number.isFinite(numeric) || numeric <= 0) {
      setFieldErrors({ amount: "Enter an amount." })
      return
    }
    if (minimum > 0 && numeric < minimum) {
      setFieldErrors({
        amount: `The minimum deposit is ${formatMoney(config?.minimumDeposit)}.`,
      })
      return
    }

    setFieldErrors({})
    setSubmitting(true)

    try {
      await api.deposits.create({
        amount: numeric,
        method,
        reference: reference.trim() || undefined,
        proof,
      })

      toast.success(
        "Deposit request submitted",
        "It will show as pending until an administrator confirms your payment."
      )
      setAmount("")
      setReference("")
      setProof(null)
      if (fileInput.current) fileInput.current.value = ""
      history.reload()
    } catch (cause) {
      // Field-level problems belong on the field, not in a banner.
      if (isApiError(cause) && cause.details?.length) {
        const mapped: Record<string, string> = {}
        for (const detail of cause.details) {
          const key = detail.path?.split(".").pop()
          if (key) mapped[key] = detail.message
        }
        setFieldErrors(mapped)
      }
      toast.fromError(cause, "Could not submit the deposit request.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Deposit"
        description="Send your payment using the details below, then tell us about it."
      />

      {methods.error && !config ? (
        <ErrorState
          title="Could not load payment details"
          onRetry={methods.reload}
        />
      ) : methods.loading && !config ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      ) : (
        config && (
          <>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Deposit method"
            >
              {available.map((value) => {
                const meta = METHOD_META[value]
                const Icon = meta.icon
                const active = method === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMethod(value)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-4 focus-visible:ring-primary-200",
                      active
                        ? "border-primary-600 bg-primary-600 text-white"
                        : "border-secondary-200 bg-white text-secondary-700 hover:border-primary-300 hover:text-primary-700"
                    )}
                  >
                    <Icon className="size-4" />
                    {meta.label}
                  </button>
                )
              })}
            </div>

            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-secondary-100/80 bg-white p-5 shadow-sm">
                <h3 className="font-heading text-lg font-bold text-secondary-900">
                  Where to send it
                </h3>
                <div className="mt-4">
                  <MethodDetails method={method} config={config} />
                </div>
              </section>

              {method === "CARD" ? (
                <section className="rounded-2xl border border-secondary-100/80 bg-white p-5 shadow-sm">
                  <h3 className="font-heading text-lg font-bold text-secondary-900">
                    Card deposits
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-secondary-600">
                    Card payments are arranged individually. Email us and we will
                    send you a secure payment link — we never take card numbers
                    over this form.
                  </p>
                  <Button asChild className="mt-4">
                    <a href={`mailto:${config.supportEmail}`}>
                      <Mail className="size-4" />
                      {config.supportEmail}
                    </a>
                  </Button>
                </section>
              ) : (
                <section className="rounded-2xl border border-secondary-100/80 bg-white p-5 shadow-sm">
                  <h3 className="font-heading text-lg font-bold text-secondary-900">
                    Tell us about your payment
                  </h3>

                  <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
                    <Input
                      id="deposit-amount"
                      label="Amount (USD)"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      error={fieldErrors.amount}
                      hint={`Minimum ${formatMoney(config.minimumDeposit)}`}
                      disabled={submitting}
                    />

                    <Input
                      id="deposit-reference"
                      label="Payment reference"
                      optional
                      placeholder="e.g. the transaction hash or bank reference"
                      value={reference}
                      onChange={(event) => setReference(event.target.value)}
                      error={fieldErrors.reference}
                      disabled={submitting}
                    />

                    <div>
                      <span className="mb-2 block text-sm font-medium text-secondary-700">
                        Proof of payment
                        <span className="ml-1.5 text-xs font-normal text-secondary-400">
                          optional
                        </span>
                      </span>

                      <input
                        ref={fileInput}
                        id="deposit-proof"
                        type="file"
                        accept={ALLOWED_MIME.join(",")}
                        className="sr-only"
                        disabled={submitting}
                        onChange={(event) =>
                          pickFile(event.target.files?.[0] ?? null)
                        }
                      />

                      {proof ? (
                        <div className="flex items-center gap-3 rounded-xl border border-secondary-200 bg-secondary-50/60 px-4 py-3">
                          <FileUp className="size-4 shrink-0 text-primary-600" />
                          <span className="min-w-0 flex-1 truncate text-sm text-secondary-700">
                            {proof.name}
                          </span>
                          <span className="shrink-0 text-xs text-secondary-500 tabular">
                            {(proof.size / 1024).toFixed(0)} KB
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setProof(null)
                              if (fileInput.current) fileInput.current.value = ""
                            }}
                            aria-label="Remove file"
                            className="shrink-0 rounded-lg p-1 text-secondary-400 transition-colors hover:bg-secondary-200 hover:text-secondary-700"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      ) : (
                        <label
                          htmlFor="deposit-proof"
                          className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-secondary-300 bg-secondary-50/50 px-4 py-6 text-sm text-secondary-600 transition-colors hover:border-primary-400 hover:text-primary-700"
                        >
                          <Upload className="size-4" />
                          Choose a receipt or screenshot
                        </label>
                      )}

                      {fieldErrors.proof ? (
                        <p className="mt-1.5 text-sm text-red-600">
                          {fieldErrors.proof}
                        </p>
                      ) : (
                        <p className="mt-1.5 text-xs text-secondary-500">
                          JPEG, PNG, WebP, or PDF — up to 5 MB.
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={submitting}
                    >
                      {submitting ? "Submitting…" : "Submit deposit request"}
                    </Button>

                    <p className="text-center text-xs text-secondary-500">
                      Your balance updates once an administrator confirms the
                      payment — not when you submit this form.
                    </p>
                  </form>
                </section>
              )}
            </div>

            <section className="mt-8">
              <h3 className="mb-3 font-heading text-lg font-bold text-secondary-900">
                Your deposit requests
              </h3>
              <DepositHistory
                data={history.data?.deposits ?? []}
                loading={history.loading && !history.data}
                error={history.error}
                onRetry={history.reload}
              />
            </section>
          </>
        )
      )}
    </div>
  )
}

function MethodDetails({
  method,
  config,
}: {
  method: DepositMethod
  config: DepositMethods
}) {
  if (method === "BANK_TRANSFER" && config.bank) {
    const bank = config.bank
    return (
      <dl className="space-y-1">
        <DetailRow label="Bank" value={bank.bankName} />
        <DetailRow label="Account name" value={bank.accountName} />
        <DetailRow label="Account number" value={bank.accountNumber} copyable />
        {bank.routingNumber && (
          <DetailRow label="Routing number" value={bank.routingNumber} copyable />
        )}
        {bank.swiftCode && (
          <DetailRow label="SWIFT / BIC" value={bank.swiftCode} copyable />
        )}
      </dl>
    )
  }

  if (method === "CRYPTO") {
    return (
      <div className="space-y-4">
        {config.crypto.map((wallet) => (
          <div
            key={`${wallet.currency}-${wallet.walletAddress}`}
            className="rounded-xl border border-secondary-200 bg-secondary-50/50 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-secondary-900">
                {wallet.label}
              </p>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-secondary-600">
                {wallet.network}
              </span>
            </div>
            <div className="mt-2 flex items-start gap-2">
              <code className="min-w-0 flex-1 font-mono text-xs leading-relaxed break-all text-secondary-700">
                {wallet.walletAddress}
              </code>
              <CopyButton
                value={wallet.walletAddress}
                label={`Copy ${wallet.currency} address`}
              />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (method === "DIGITAL_WALLET") {
    return (
      <div className="space-y-4">
        {config.digitalWallets.map((wallet) => (
          <div
            key={`${wallet.provider}-${wallet.handle}`}
            className="rounded-xl border border-secondary-200 bg-secondary-50/50 p-4"
          >
            <p className="text-sm font-semibold text-secondary-900">
              {wallet.provider}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 font-mono text-xs break-all text-secondary-700">
                {wallet.handle}
              </code>
              <CopyButton
                value={wallet.handle}
                label={`Copy ${wallet.provider} handle`}
              />
            </div>
            {wallet.instructions && (
              <p className="mt-2 text-xs leading-relaxed text-secondary-600">
                {wallet.instructions}
              </p>
            )}
          </div>
        ))}
      </div>
    )
  }

  if (method === "CARD") {
    return (
      <p className="text-sm leading-relaxed text-secondary-600">
        No account details are needed for card payments — we will send you a
        secure link instead.
      </p>
    )
  }

  return (
    <p className="text-sm text-secondary-600">
      This method has not been configured yet. Please choose another.
    </p>
  )
}

function DetailRow({
  label,
  value,
  copyable = false,
}: {
  label: string
  value: string
  copyable?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-secondary-100 py-2.5 last:border-0">
      <dt className="shrink-0 text-sm text-secondary-500">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-sm font-semibold text-secondary-900">
          {value}
        </span>
        {copyable && <CopyButton value={value} label={`Copy ${label}`} />}
      </dd>
    </div>
  )
}

function DepositHistory({
  data,
  loading,
  error,
  onRetry,
}: {
  data: Array<{
    id: string
    amount: string
    method: DepositMethod
    reference: string | null
    status: string
    reviewNote: string | null
    hasProof: boolean
    createdAt: string
  }>
  loading: boolean
  error: unknown
  onRetry: () => void
}) {
  if (error) {
    return <ErrorState title="Could not load your requests" onRetry={onRetry} />
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }, (_, index) => (
          <Skeleton key={index} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={Banknote}
        title="No deposit requests yet"
        description="Once you submit one, you can track its status here."
      />
    )
  }

  return (
    <ul className="space-y-3">
      {data.map((deposit) => (
        <li
          key={deposit.id}
          className="rounded-xl border border-secondary-100/80 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-secondary-900">
                <Money value={deposit.amount} />
                <span className="ml-2 text-sm font-normal text-secondary-500">
                  {METHOD_META[deposit.method]?.label ?? deposit.method}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-secondary-500">
                {formatDate(deposit.createdAt)}
                {deposit.reference && ` · ref ${deposit.reference}`}
                {deposit.hasProof && " · proof attached"}
              </p>
            </div>
            <StatusBadge status={deposit.status} />
          </div>

          {deposit.reviewNote && (
            <p className="mt-3 rounded-lg bg-secondary-50 px-3 py-2 text-sm text-secondary-600">
              <span className="font-medium text-secondary-700">Note:</span>{" "}
              {deposit.reviewNote}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}
