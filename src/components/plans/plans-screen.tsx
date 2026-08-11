"use client"

import { useState } from "react"
import { Check, Coins, TrendingUp } from "lucide-react"

import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { EmptyState, ErrorState } from "@/components/app/empty-state"
import { Money } from "@/components/app/money"
import { PageHeader } from "@/components/app/page-header"
import { StatusBadge } from "@/components/app/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast"
import * as api from "@/lib/api/endpoints"
import type { Plan, Subscription } from "@/lib/api/types"
import { formatDate, formatMoney, formatPercent } from "@/lib/format"
import { useAsyncData } from "@/lib/use-async-data"
import { cn } from "@/lib/utils"

/**
 * Investment plans you can actually subscribe to.
 *
 * This replaces SwiftEdge's "Trade" section: nine static instrument cards whose
 * buttons had no handlers at all.
 */
export function PlansScreen() {
  const toast = useToast()
  const plans = useAsyncData(() => api.plans.list(), "plans")
  const subs = useAsyncData(() => api.subscriptions.list(), "subscriptions")

  const [subscribing, setSubscribing] = useState<Plan | null>(null)
  const [amount, setAmount] = useState("")
  const [amountError, setAmountError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [cancelling, setCancelling] = useState<Subscription | null>(null)
  const [cancelBusy, setCancelBusy] = useState(false)

  const available = subs.data?.available ?? "0.00"

  function openSubscribe(plan: Plan) {
    setSubscribing(plan)
    setAmount(plan.minDeposit)
    setAmountError(undefined)
  }

  async function confirmSubscribe() {
    if (!subscribing) return

    const numeric = Number(amount)
    const min = Number(subscribing.minDeposit)
    const max = subscribing.maxDeposit ? Number(subscribing.maxDeposit) : null

    if (!Number.isFinite(numeric) || numeric <= 0) {
      setAmountError("Enter an amount.")
      return
    }
    if (numeric < min) {
      setAmountError(`This plan starts at ${formatMoney(subscribing.minDeposit)}.`)
      return
    }
    if (max !== null && numeric > max) {
      setAmountError(`This plan caps at ${formatMoney(subscribing.maxDeposit)}.`)
      return
    }
    if (numeric > Number(available)) {
      setAmountError(
        `That is more than your available balance of ${formatMoney(available)}.`
      )
      return
    }

    setBusy(true)
    try {
      await api.subscriptions.create(subscribing.slug, numeric)
      toast.success(
        `Subscribed to ${subscribing.name}`,
        "Your principal is now working. Returns accrue daily."
      )
      setSubscribing(null)
      subs.reload()
    } catch (cause) {
      toast.fromError(cause, "Could not subscribe to that plan.")
    } finally {
      setBusy(false)
    }
  }

  async function confirmCancel() {
    if (!cancelling) return
    setCancelBusy(true)
    try {
      await api.subscriptions.cancel(cancelling.id)
      toast.success("Subscription cancelled")
      setCancelling(null)
      subs.reload()
    } catch (cause) {
      toast.fromError(cause, "Could not cancel that subscription.")
    } finally {
      setCancelBusy(false)
    }
  }

  const active = subs.data?.subscriptions ?? []

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        title="Investment plans"
        description="Put your available balance to work. Returns accrue daily for the plan's term."
        actions={
          <div className="rounded-xl bg-secondary-50 px-4 py-2 text-sm">
            <span className="text-secondary-600">Available </span>
            <Money value={available} className="font-bold text-secondary-900" />
          </div>
        }
      />

      {active.length > 0 && (
        <section className="mb-8">
          <h3 className="mb-3 font-heading text-lg font-bold text-secondary-900">
            Your subscriptions
          </h3>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((subscription) => (
              <li
                key={subscription.id}
                className="rounded-xl border border-secondary-100/80 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-secondary-900">
                    {subscription.plan.name}
                  </p>
                  <StatusBadge status={subscription.status} />
                </div>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-secondary-500">Principal</dt>
                    <dd className="font-medium">
                      <Money value={subscription.principal} />
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-secondary-500">Accrued</dt>
                    <dd className="font-medium">
                      <Money value={subscription.totalAccrued} signed />
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-secondary-500">Ends</dt>
                    <dd className="font-medium text-secondary-700">
                      {formatDate(subscription.endsAt)}
                    </dd>
                  </div>
                </dl>
                {subscription.status === "ACTIVE" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setCancelling(subscription)}
                  >
                    Cancel
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <h3 className="mb-3 font-heading text-lg font-bold text-secondary-900">
        Available plans
      </h3>

      {plans.error && !plans.data ? (
        <ErrorState title="Could not load the plans" onRetry={plans.reload} />
      ) : plans.loading && !plans.data ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-96 w-full rounded-2xl" />
          ))}
        </div>
      ) : (plans.data?.plans.length ?? 0) === 0 ? (
        <EmptyState
          icon={Coins}
          title="No plans are open right now"
          description="Check back shortly — new tiers are added regularly."
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {plans.data?.plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onSubscribe={() => openSubscribe(plan)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={subscribing !== null}
        onOpenChange={(next) => !busy && !next && setSubscribing(null)}
        title={subscribing ? `Subscribe to ${subscribing.name}` : ""}
        description="The principal moves out of your available balance and starts earning immediately."
        confirmLabel="Subscribe"
        busy={busy}
        onConfirm={() => void confirmSubscribe()}
      >
        {subscribing && (
          <div className="space-y-3">
            <Input
              id="subscribe-amount"
              label="Principal (USD)"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              error={amountError}
              hint={`${formatMoney(subscribing.minDeposit)}${
                subscribing.maxDeposit
                  ? ` – ${formatMoney(subscribing.maxDeposit)}`
                  : " and up"
              } · available ${formatMoney(available)}`}
              disabled={busy}
            />
            <p className="text-xs text-secondary-500">
              {formatPercent(subscribing.dailyReturnPercent)} per day for{" "}
              {subscribing.durationDays} days.
            </p>
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(next) => !cancelBusy && !next && setCancelling(null)}
        title="Cancel this subscription?"
        description="Accrual stops immediately. Check your plan's terms for how the principal is returned."
        confirmLabel="Cancel subscription"
        cancelLabel="Keep it"
        tone="danger"
        busy={cancelBusy}
        onConfirm={() => void confirmCancel()}
      />
    </div>
  )
}

function PlanCard({
  plan,
  onSubscribe,
}: {
  plan: Plan
  onSubscribe: () => void
}) {
  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-2xl border bg-white p-6 shadow-sm transition-all",
        plan.isPopular
          ? "border-2 border-primary-600 shadow-xl shadow-primary-600/10"
          : "border-secondary-100/80 hover:border-primary-200 hover:shadow-lg"
      )}
    >
      {plan.isPopular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary-600 px-3 py-1 text-[10px] font-bold tracking-wider text-white uppercase shadow-lg">
          Most popular
        </span>
      )}

      <h4 className="font-heading text-xl font-bold text-secondary-900">
        {plan.name}
      </h4>
      {plan.description && (
        <p className="mt-2 text-sm leading-relaxed text-secondary-600">
          {plan.description}
        </p>
      )}

      <div className="mt-5 flex items-baseline gap-1.5">
        <span className="font-heading text-4xl font-bold tracking-tight text-primary-600 tabular">
          {formatPercent(plan.dailyReturnPercent)}
        </span>
        <span className="text-sm text-secondary-500">/ day</span>
      </div>

      <dl className="mt-4 space-y-1.5 border-t border-secondary-100 pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-secondary-500">Term</dt>
          <dd className="font-medium text-secondary-900">
            {plan.durationDays} days
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-secondary-500">Minimum</dt>
          <dd className="font-medium text-secondary-900">
            <Money value={plan.minDeposit} />
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-secondary-500">Maximum</dt>
          <dd className="font-medium text-secondary-900">
            {plan.maxDeposit ? <Money value={plan.maxDeposit} /> : "No cap"}
          </dd>
        </div>
      </dl>

      {plan.features.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-secondary-100 pt-4">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <span className="text-secondary-600">{feature}</span>
            </li>
          ))}
        </ul>
      )}

      <Button
        onClick={onSubscribe}
        variant={plan.isPopular ? "default" : "outline"}
        className="mt-6 w-full"
      >
        <TrendingUp className="size-4" />
        Subscribe
      </Button>
    </div>
  )
}
