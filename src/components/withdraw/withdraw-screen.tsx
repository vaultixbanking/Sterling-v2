"use client"

import { useMemo, useState } from "react"
import { Banknote, Bitcoin, Lock, Wallet } from "lucide-react"

import { AccountIdChip } from "@/components/app/account-id-chip"
import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { EmptyState, ErrorState } from "@/components/app/empty-state"
import { Money } from "@/components/app/money"
import { PageHeader } from "@/components/app/page-header"
import { PinInput } from "@/components/app/pin-input"
import { StatusBadge } from "@/components/app/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast"
import { isApiError } from "@/lib/api/client"
import * as api from "@/lib/api/endpoints"
import type {
  CreateWithdrawalInput,
  WithdrawalMethod,
  WithdrawalRequest,
} from "@/lib/api/types"
import { formatDate, formatMoney } from "@/lib/format"
import { useAsyncData } from "@/lib/use-async-data"
import { cn } from "@/lib/utils"

/**
 * Request a withdrawal.
 *
 * The fee shown here is the fee the server charges: both come from
 * `WITHDRAWAL_FEE_PERCENT`, sent down with the request list. SwiftEdge printed
 * 1.5% on one form and 1% on the other while the server quietly took 5%.
 */

/**
 * Fee arithmetic on cents, in integers.
 *
 * Money is a decimal string everywhere else in this app precisely so it never
 * touches a float — `0.1 + 0.2` is the classic reason. Here the user needs a
 * live preview before the server can be asked, so the conversion happens once,
 * in cents, and the result goes straight back to a string.
 */
function previewFee(amount: string, feePercent: string) {
  const cents = Math.round(Number(amount) * 100)
  const percent = Number(feePercent)

  if (!Number.isFinite(cents) || !Number.isFinite(percent) || cents <= 0) {
    return { fee: "0.00", net: "0.00" }
  }

  const feeCents = Math.round((cents * percent) / 100)
  return {
    fee: (feeCents / 100).toFixed(2),
    net: ((cents - feeCents) / 100).toFixed(2),
  }
}

export function WithdrawScreen() {
  const toast = useToast()
  const portfolio = useAsyncData(() => api.portfolio.summary(), "portfolio")
  const history = useAsyncData(() => api.withdrawals.list(), "withdrawals")

  const [method, setMethod] = useState<WithdrawalMethod>("CRYPTO")
  const [amount, setAmount] = useState("")
  const [crypto, setCrypto] = useState({
    walletAddress: "",
    network: "",
    currency: "",
  })
  const [bank, setBank] = useState({
    bankName: "",
    accountName: "",
    accountNumber: "",
    routingNumber: "",
    swiftCode: "",
  })

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState(false)
  const [pin, setPin] = useState("")
  const [pinError, setPinError] = useState<string | undefined>()
  const [submitting, setSubmitting] = useState(false)
  const [cancelling, setCancelling] = useState<WithdrawalRequest | null>(null)
  const [cancelBusy, setCancelBusy] = useState(false)

  const limits = history.data?.limits
  const feePercent = limits?.feePercent ?? "0.00"
  const minimum = limits?.minimum ?? "0.00"
  const available = portfolio.data?.available ?? "0.00"

  const { fee, net } = useMemo(
    () => previewFee(amount, feePercent),
    [amount, feePercent]
  )

  function validate(): boolean {
    const errors: Record<string, string> = {}
    const numeric = Number(amount)

    if (!Number.isFinite(numeric) || numeric <= 0) {
      errors.amount = "Enter an amount."
    } else if (numeric < Number(minimum)) {
      errors.amount = `The minimum withdrawal is ${formatMoney(minimum)}.`
    } else if (numeric > Number(available)) {
      // Checked here as well as on the server so the user is told before they
      // are asked for a PIN, not after.
      errors.amount = `That is more than your available balance of ${formatMoney(available)}.`
    }

    if (method === "CRYPTO") {
      if (!crypto.walletAddress.trim())
        errors.walletAddress = "Enter the destination wallet address."
      if (!crypto.network.trim()) errors.network = "Enter the network."
    } else {
      if (!bank.bankName.trim()) errors.bankName = "Enter the bank name."
      if (!bank.accountName.trim())
        errors.accountName = "Enter the account holder's name."
      if (!bank.accountNumber.trim())
        errors.accountNumber = "Enter the account number."
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  function review(event: React.FormEvent) {
    event.preventDefault()
    if (!validate()) return
    setPin("")
    setPinError(undefined)
    setConfirming(true)
  }

  async function submit() {
    if (pin.length < 4) {
      setPinError("Enter the PIN your account manager issued.")
      return
    }

    setSubmitting(true)
    setPinError(undefined)

    const payload: CreateWithdrawalInput =
      method === "CRYPTO"
        ? {
            amount: Number(amount),
            method,
            pin,
            walletAddress: crypto.walletAddress.trim(),
            network: crypto.network.trim(),
            currency: crypto.currency.trim() || undefined,
          }
        : {
            amount: Number(amount),
            method,
            pin,
            bankName: bank.bankName.trim(),
            accountName: bank.accountName.trim(),
            accountNumber: bank.accountNumber.trim(),
            routingNumber: bank.routingNumber.trim() || undefined,
            swiftCode: bank.swiftCode.trim() || undefined,
          }

    try {
      await api.withdrawals.create(payload)
      toast.success(
        "Withdrawal requested",
        "The amount is reserved from your balance while an administrator reviews it."
      )
      setConfirming(false)
      setAmount("")
      setPin("")
      history.reload()
      portfolio.reload()
    } catch (cause) {
      // A wrong PIN keeps the dialog open so it can be retyped in place.
      if (isApiError(cause) && /pin/i.test(cause.message)) {
        setPinError(cause.message)
      } else {
        setConfirming(false)
        toast.fromError(cause, "Could not submit the withdrawal.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function cancel() {
    if (!cancelling) return
    setCancelBusy(true)
    try {
      await api.withdrawals.cancel(cancelling.id)
      toast.success("Withdrawal cancelled", "The reserved amount is available again.")
      setCancelling(null)
      history.reload()
      portfolio.reload()
    } catch (cause) {
      toast.fromError(cause, "Could not cancel the request.")
    } finally {
      setCancelBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Withdraw"
        description="Move funds out of your account to a wallet or bank."
      />

      <AccountIdChip />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-secondary-100/80 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-secondary-50 px-4 py-3">
            <span className="text-sm text-secondary-600">Available</span>
            {portfolio.loading && !portfolio.data ? (
              <Skeleton className="h-5 w-24" />
            ) : (
              <Money
                value={available}
                className="text-lg font-bold text-secondary-900"
              />
            )}
          </div>

          <div className="flex gap-2" role="group" aria-label="Withdrawal method">
            {(
              [
                { value: "CRYPTO" as const, label: "Crypto", icon: Bitcoin },
                { value: "BANK" as const, label: "Bank", icon: Banknote },
              ]
            ).map((option) => {
              const Icon = option.icon
              const active = method === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMethod(option.value)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-4 focus-visible:ring-primary-200",
                    active
                      ? "border-primary-600 bg-primary-600 text-white"
                      : "border-secondary-200 bg-white text-secondary-700 hover:border-primary-300"
                  )}
                >
                  <Icon className="size-4" />
                  {option.label}
                </button>
              )
            })}
          </div>

          <form onSubmit={review} className="mt-5 space-y-4" noValidate>
            <Input
              id="withdraw-amount"
              label="Amount (USD)"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              error={fieldErrors.amount}
              hint={
                limits ? `Minimum ${formatMoney(minimum)}` : "Loading limits…"
              }
            />

            {method === "CRYPTO" ? (
              <>
                <Input
                  id="withdraw-wallet"
                  label="Wallet address"
                  placeholder="Destination address"
                  value={crypto.walletAddress}
                  onChange={(event) =>
                    setCrypto((c) => ({ ...c, walletAddress: event.target.value }))
                  }
                  error={fieldErrors.walletAddress}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    id="withdraw-network"
                    label="Network"
                    placeholder="e.g. TRC20"
                    value={crypto.network}
                    onChange={(event) =>
                      setCrypto((c) => ({ ...c, network: event.target.value }))
                    }
                    error={fieldErrors.network}
                  />
                  <Input
                    id="withdraw-currency"
                    label="Currency"
                    optional
                    placeholder="e.g. USDT"
                    value={crypto.currency}
                    onChange={(event) =>
                      setCrypto((c) => ({ ...c, currency: event.target.value }))
                    }
                  />
                </div>
              </>
            ) : (
              <>
                <Input
                  id="withdraw-bank-name"
                  label="Bank name"
                  value={bank.bankName}
                  onChange={(event) =>
                    setBank((b) => ({ ...b, bankName: event.target.value }))
                  }
                  error={fieldErrors.bankName}
                />
                <Input
                  id="withdraw-account-name"
                  label="Account holder"
                  value={bank.accountName}
                  onChange={(event) =>
                    setBank((b) => ({ ...b, accountName: event.target.value }))
                  }
                  error={fieldErrors.accountName}
                />
                <Input
                  id="withdraw-account-number"
                  label="Account number"
                  value={bank.accountNumber}
                  onChange={(event) =>
                    setBank((b) => ({ ...b, accountNumber: event.target.value }))
                  }
                  error={fieldErrors.accountNumber}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    id="withdraw-routing"
                    label="Routing number"
                    optional
                    value={bank.routingNumber}
                    onChange={(event) =>
                      setBank((b) => ({ ...b, routingNumber: event.target.value }))
                    }
                  />
                  <Input
                    id="withdraw-swift"
                    label="SWIFT / BIC"
                    optional
                    value={bank.swiftCode}
                    onChange={(event) =>
                      setBank((b) => ({ ...b, swiftCode: event.target.value }))
                    }
                  />
                </div>
              </>
            )}

            <FeeBreakdown
              amount={amount}
              fee={fee}
              net={net}
              feePercent={feePercent}
              known={Boolean(limits)}
            />

            <Button type="submit" className="w-full" disabled={!limits}>
              <Lock className="size-4" />
              Review withdrawal
            </Button>
          </form>
        </section>

        <section>
          <h3 className="mb-3 font-heading text-lg font-bold text-secondary-900">
            Your requests
          </h3>
          {history.error && !history.data ? (
            <ErrorState title="Could not load your requests" onRetry={history.reload} />
          ) : history.loading && !history.data ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }, (_, index) => (
                <Skeleton key={index} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : (history.data?.withdrawals.length ?? 0) === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No withdrawals yet"
              description="Requests you make will appear here with their status."
            />
          ) : (
            <ul className="space-y-3">
              {history.data?.withdrawals.map((request) => (
                <li
                  key={request.id}
                  className="rounded-xl border border-secondary-100/80 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-secondary-900">
                        <Money value={request.amount} />
                        <span className="ml-2 text-sm font-normal text-secondary-500">
                          {request.method === "CRYPTO" ? "Crypto" : "Bank"}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-secondary-500">
                        {formatDate(request.createdAt)} · fee{" "}
                        {formatMoney(request.fee)}
                      </p>
                    </div>
                    <StatusBadge status={request.status} />
                  </div>

                  {request.reviewNote && (
                    <p className="mt-3 rounded-lg bg-secondary-50 px-3 py-2 text-sm text-secondary-600">
                      <span className="font-medium text-secondary-700">Note:</span>{" "}
                      {request.reviewNote}
                    </p>
                  )}

                  {request.status === "PENDING" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => setCancelling(request)}
                    >
                      Cancel request
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={(next) => !submitting && setConfirming(next)}
        title="Confirm withdrawal"
        description="Enter your withdrawal PIN to authorise this request."
        confirmLabel="Withdraw"
        onConfirm={() => void submit()}
        busy={submitting}
      >
        <div className="space-y-4">
          <dl className="rounded-xl bg-secondary-50 p-4 text-sm">
            <div className="flex justify-between py-1">
              <dt className="text-secondary-600">Amount</dt>
              <dd className="font-semibold text-secondary-900">
                <Money value={amount || "0"} />
              </dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-secondary-600">Fee ({feePercent}%)</dt>
              <dd className="font-semibold text-secondary-900">
                −<Money value={fee} />
              </dd>
            </div>
            <div className="mt-1 flex justify-between border-t border-secondary-200 pt-2">
              <dt className="font-medium text-secondary-700">You receive</dt>
              <dd className="font-bold text-secondary-900">
                <Money value={net} />
              </dd>
            </div>
          </dl>

          <PinInput
            value={pin}
            onChange={setPin}
            disabled={submitting}
            error={pinError}
            autoFocus
          />

          <p className="text-xs text-secondary-500">
            No PIN? Your account manager issues one on request.
          </p>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(next) => !cancelBusy && !next && setCancelling(null)}
        title="Cancel this withdrawal?"
        description={
          cancelling ? (
            <>
              The reserved <Money value={cancelling.amount} /> returns to your
              available balance. This cannot be undone — you would need to make a
              new request.
            </>
          ) : undefined
        }
        confirmLabel="Cancel request"
        cancelLabel="Keep it"
        tone="danger"
        busy={cancelBusy}
        onConfirm={() => void cancel()}
      />
    </div>
  )
}

function FeeBreakdown({
  amount,
  fee,
  net,
  feePercent,
  known,
}: {
  amount: string
  fee: string
  net: string
  feePercent: string
  known: boolean
}) {
  return (
    <dl className="rounded-xl border border-secondary-200 bg-secondary-50/60 p-4 text-sm">
      <div className="flex justify-between py-1">
        <dt className="text-secondary-600">You withdraw</dt>
        <dd className="font-medium text-secondary-900">
          <Money value={amount || "0"} />
        </dd>
      </div>
      <div className="flex justify-between py-1">
        <dt className="text-secondary-600">
          Processing fee{known ? ` (${feePercent}%)` : ""}
        </dt>
        <dd className="font-medium text-secondary-900">
          −<Money value={fee} />
        </dd>
      </div>
      <div className="mt-1 flex justify-between border-t border-secondary-200 pt-2">
        <dt className="font-medium text-secondary-700">You receive</dt>
        <dd className="font-bold text-secondary-900">
          <Money value={net} />
        </dd>
      </div>
    </dl>
  )
}
