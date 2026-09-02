"use client"

import { useState } from "react"
import { Pencil, Plus, Star, Trash2, X } from "lucide-react"

import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { ErrorState } from "@/components/app/empty-state"
import { Money } from "@/components/app/money"
import { PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast"
import * as api from "@/lib/api/endpoints"
import type { AdminPlan, PlanInput } from "@/lib/api/types"
import { useAsyncData } from "@/lib/use-async-data"
import { cn } from "@/lib/utils"

/**
 * Plan administration.
 *
 * Plans were seeded once and only editable with a psql session against
 * production, so changing a headline rate meant hand-editing the table the
 * nightly accrual job reads.
 *
 * The screen leans on one fact throughout: a rate change reprices **live**
 * subscriptions from the next accrual, because payouts are computed from the
 * plan a subscription points at rather than copied onto it at signup. Every
 * edit form says so, and the delete path shows the principal at stake.
 */

/** Form state is strings — a half-typed number is not a number. */
interface PlanForm {
  slug: string
  name: string
  dailyReturnPercent: string
  durationDays: string
  minDeposit: string
  maxDeposit: string
  referralBonusPercent: string
  description: string
  features: string
  isPopular: boolean
  isActive: boolean
  sortOrder: string
}

const BLANK: PlanForm = {
  slug: "",
  name: "",
  dailyReturnPercent: "",
  durationDays: "",
  minDeposit: "",
  maxDeposit: "",
  referralBonusPercent: "0",
  description: "",
  features: "",
  isPopular: false,
  isActive: true,
  sortOrder: "0",
}

function toForm(plan: AdminPlan): PlanForm {
  return {
    slug: plan.slug,
    name: plan.name,
    dailyReturnPercent: plan.dailyReturnPercent,
    durationDays: String(plan.durationDays),
    minDeposit: plan.minDeposit,
    maxDeposit: plan.maxDeposit ?? "",
    referralBonusPercent: String(plan.referralBonusPercent),
    description: plan.description ?? "",
    features: plan.features.join("\n"),
    isPopular: plan.isPopular,
    isActive: plan.isActive,
    sortOrder: String(plan.sortOrder),
  }
}

/**
 * Percent in the form, basis points on the wire.
 *
 * The column is an integer bps precisely so nightly accrual never touches a
 * float, but "1.20" is what a human types — so the rounding happens here, once,
 * rather than being implied by whatever the input element produced.
 */
function toPayload(form: PlanForm): PlanInput {
  const trimmedMax = form.maxDeposit.trim()

  return {
    slug: form.slug.trim().toLowerCase(),
    name: form.name.trim(),
    dailyReturnBps: Math.round(Number(form.dailyReturnPercent) * 100),
    durationDays: Number(form.durationDays),
    minDeposit: Number(form.minDeposit),
    maxDeposit: trimmedMax === "" ? null : Number(trimmedMax),
    referralBonusPercent: Number(form.referralBonusPercent || 0),
    description: form.description.trim(),
    features: form.features
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    isPopular: form.isPopular,
    isActive: form.isActive,
    sortOrder: Number(form.sortOrder || 0),
  }
}

/** Returns the first problem, or null. Mirrors the server's own rules. */
function validate(form: PlanForm): string | null {
  if (!form.slug.trim()) return "A slug is required."
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim().toLowerCase())) {
    return "The slug may only contain lowercase letters, numbers and single hyphens."
  }
  if (!form.name.trim()) return "A name is required."
  if (!form.description.trim()) return "A description is required."

  const rate = Number(form.dailyReturnPercent)
  if (!Number.isFinite(rate) || rate <= 0) {
    return "The daily return must be greater than zero."
  }

  const days = Number(form.durationDays)
  if (!Number.isInteger(days) || days < 1) {
    return "The duration must be a whole number of days."
  }

  const min = Number(form.minDeposit)
  if (!Number.isFinite(min) || min < 0) return "The minimum deposit is not valid."

  const maxRaw = form.maxDeposit.trim()
  if (maxRaw !== "") {
    const max = Number(maxRaw)
    if (!Number.isFinite(max) || max <= 0) {
      return "The maximum deposit is not valid."
    }
    if (max < min) return "The maximum deposit cannot be below the minimum."
  }

  return null
}

export function AdminPlansScreen() {
  const toast = useToast()
  const data = useAsyncData(() => api.admin.plans(), "admin-plans")

  const [editing, setEditing] = useState<AdminPlan | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<PlanForm>(BLANK)
  const [busy, setBusy] = useState(false)

  const [retiring, setRetiring] = useState<AdminPlan | null>(null)
  const [retireBusy, setRetireBusy] = useState(false)

  const plans = data.data?.plans ?? []

  function openCreate() {
    setForm(BLANK)
    setCreating(true)
  }

  function openEdit(plan: AdminPlan) {
    setForm(toForm(plan))
    setEditing(plan)
  }

  function closeForm() {
    if (busy) return
    setCreating(false)
    setEditing(null)
  }

  async function save() {
    const problem = validate(form)
    if (problem) {
      toast.error(problem)
      return
    }

    setBusy(true)
    try {
      const payload = toPayload(form)

      if (editing) {
        await api.admin.updatePlan(editing.id, payload)
        toast.success(`${payload.name} updated`)
      } else {
        await api.admin.createPlan(payload)
        toast.success(`${payload.name} created`)
      }

      closeForm()
      data.reload()
    } catch (cause) {
      toast.fromError(cause, "Could not save the plan.")
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(plan: AdminPlan) {
    try {
      await api.admin.updatePlan(plan.id, { isActive: !plan.isActive })
      toast.success(plan.isActive ? `${plan.name} hidden` : `${plan.name} live`)
      data.reload()
    } catch (cause) {
      toast.fromError(cause, "Could not change the plan's status.")
    }
  }

  async function retire() {
    if (!retiring) return
    setRetireBusy(true)
    try {
      const result = await api.admin.retirePlan(retiring.id)
      toast.success(
        result.deleted
          ? `${retiring.name} deleted`
          : `${retiring.name} deactivated — existing subscriptions keep running`
      )
      setRetiring(null)
      data.reload()
    } catch (cause) {
      toast.fromError(cause, "Could not retire the plan.")
    } finally {
      setRetireBusy(false)
    }
  }

  if (data.error && !data.data) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <ErrorState
          title="Could not load plans"
          description="The API may be unreachable."
          onRetry={data.reload}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Investment plans"
        description="Rates, terms and availability. Changes apply to the next nightly accrual."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            New plan
          </Button>
        }
      />

      {!data.data ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      ) : plans.length === 0 ? (
        <p className="rounded-2xl border border-secondary-100/80 bg-white p-6 text-sm text-secondary-500">
          No plans yet. Create one to make it selectable on the plans page.
        </p>
      ) : (
        <ul className="space-y-3">
          {plans.map((plan) => (
            <li
              key={plan.id}
              className={cn(
                "rounded-2xl border bg-white p-5 shadow-sm",
                plan.isActive
                  ? "border-secondary-100/80"
                  : "border-dashed border-secondary-200 bg-secondary-50/60"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-heading text-lg font-bold text-secondary-900">
                      {plan.name}
                    </h3>
                    <code className="rounded bg-secondary-100 px-1.5 py-0.5 text-xs text-secondary-600">
                      {plan.slug}
                    </code>
                    {plan.isPopular && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        <Star className="size-3" />
                        Popular
                      </span>
                    )}
                    {!plan.isActive && (
                      <span className="rounded-full bg-secondary-200 px-2 py-0.5 text-xs font-semibold text-secondary-700">
                        Hidden
                      </span>
                    )}
                  </div>
                  <p className="mt-1 max-w-2xl text-sm text-secondary-600">
                    {plan.description}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void toggleActive(plan)}
                  >
                    {plan.isActive ? (
                      <>
                        <X className="size-4" />
                        Hide
                      </>
                    ) : (
                      "Make live"
                    )}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(plan)}>
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                  <button
                    type="button"
                    onClick={() => setRetiring(plan)}
                    aria-label={`Retire ${plan.name}`}
                    className="rounded-lg p-2 text-secondary-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>

              <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-secondary-100 pt-4 sm:grid-cols-3 lg:grid-cols-5">
                <Fact label="Daily return" value={`${plan.dailyReturnPercent}%`} />
                <Fact label="Duration" value={`${plan.durationDays} days`} />
                <Fact
                  label="Deposit range"
                  value={
                    plan.maxDeposit
                      ? `$${plan.minDeposit} – $${plan.maxDeposit}`
                      : `$${plan.minDeposit}+`
                  }
                />
                <Fact
                  label="Referral bonus"
                  value={`${plan.referralBonusPercent}%`}
                />
                <Fact
                  label="Subscriptions"
                  value={`${plan.subscriptions.active} live / ${plan.subscriptions.total} total`}
                />
              </dl>

              {plan.subscriptions.active > 0 && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <Money value={plan.subscriptions.activePrincipal} /> of live
                  principal is riding on this plan. Editing the rate or duration
                  reprices it from the next nightly accrual.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={creating || editing !== null}
        onOpenChange={(next) => !next && closeForm()}
        title={editing ? `Edit ${editing.name}` : "New plan"}
        description={
          editing
            ? "Applies to the next nightly accrual, including subscriptions already running."
            : "It becomes selectable on the public plans page as soon as it is live."
        }
        confirmLabel={editing ? "Save changes" : "Create plan"}
        busy={busy}
        onConfirm={() => void save()}
      >
        <PlanFields form={form} setForm={setForm} busy={busy} editing={!!editing} />
      </ConfirmDialog>

      <ConfirmDialog
        open={retiring !== null}
        onOpenChange={(next) => !retireBusy && !next && setRetiring(null)}
        title={`Retire ${retiring?.name ?? "this plan"}?`}
        description={
          retiring && retiring.subscriptions.total > 0
            ? "This plan has subscriptions, so it will be deactivated rather than deleted — existing books keep accruing at their current rate, and it disappears from the public plans page."
            : "Nothing has ever subscribed to this plan, so it will be deleted outright."
        }
        confirmLabel="Retire"
        tone="danger"
        busy={retireBusy}
        onConfirm={() => void retire()}
      />
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-secondary-500">{label}</dt>
      <dd className="text-sm font-semibold text-secondary-900 tabular">
        {value}
      </dd>
    </div>
  )
}

function PlanFields({
  form,
  setForm,
  busy,
  editing,
}: {
  form: PlanForm
  setForm: React.Dispatch<React.SetStateAction<PlanForm>>
  busy: boolean
  editing: boolean
}) {
  const set = <K extends keyof PlanForm>(key: K, value: PlanForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  return (
    <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          id="plan-name"
          label="Name"
          placeholder="Gold"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          disabled={busy}
        />
        <Input
          id="plan-slug"
          label="Slug"
          placeholder="gold"
          value={form.slug}
          onChange={(e) => set("slug", e.target.value)}
          disabled={busy || editing}
          // Changing a slug on a live plan breaks any link or bookmark that
          // used it; retire and recreate instead.
          hint={editing ? "Fixed once the plan exists." : "Used in URLs."}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          id="plan-rate"
          label="Daily return (%)"
          type="number"
          step="0.01"
          min="0"
          placeholder="2.50"
          value={form.dailyReturnPercent}
          onChange={(e) => set("dailyReturnPercent", e.target.value)}
          disabled={busy}
        />
        <Input
          id="plan-duration"
          label="Duration (days)"
          type="number"
          step="1"
          min="1"
          placeholder="30"
          value={form.durationDays}
          onChange={(e) => set("durationDays", e.target.value)}
          disabled={busy}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          id="plan-min"
          label="Minimum deposit (USD)"
          type="number"
          step="0.01"
          min="0"
          value={form.minDeposit}
          onChange={(e) => set("minDeposit", e.target.value)}
          disabled={busy}
        />
        <Input
          id="plan-max"
          label="Maximum deposit (USD)"
          optional
          type="number"
          step="0.01"
          min="0"
          placeholder="Leave blank for no cap"
          value={form.maxDeposit}
          onChange={(e) => set("maxDeposit", e.target.value)}
          disabled={busy}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          id="plan-referral"
          label="Referral bonus (%)"
          type="number"
          step="1"
          min="0"
          max="100"
          value={form.referralBonusPercent}
          onChange={(e) => set("referralBonusPercent", e.target.value)}
          disabled={busy}
        />
        <Input
          id="plan-order"
          label="Sort order"
          type="number"
          step="1"
          min="0"
          value={form.sortOrder}
          onChange={(e) => set("sortOrder", e.target.value)}
          disabled={busy}
          hint="Lowest first on the plans page."
        />
      </div>

      <div>
        <label
          htmlFor="plan-description"
          className="mb-2 block text-sm font-medium text-secondary-700"
        >
          Description
        </label>
        <textarea
          id="plan-description"
          rows={2}
          value={form.description}
          disabled={busy}
          onChange={(e) => set("description", e.target.value)}
          className="w-full rounded-lg border-2 border-secondary-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
        />
      </div>

      <div>
        <label
          htmlFor="plan-features"
          className="mb-2 block text-sm font-medium text-secondary-700"
        >
          Features
        </label>
        <textarea
          id="plan-features"
          rows={5}
          value={form.features}
          disabled={busy}
          onChange={(e) => set("features", e.target.value)}
          placeholder={"One per line\nDedicated account manager\nPriority withdrawals"}
          className="w-full rounded-lg border-2 border-secondary-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
        />
        <p className="mt-1.5 text-xs text-secondary-500">
          One per line. Shown as the tick list on the public plans page.
        </p>
      </div>

      <div className="space-y-2">
        <Toggle
          id="plan-active"
          checked={form.isActive}
          disabled={busy}
          onChange={(next) => set("isActive", next)}
          label="Live on the plans page"
          hint="Off keeps the plan and its subscriptions but hides it from users."
        />
        <Toggle
          id="plan-popular"
          checked={form.isPopular}
          disabled={busy}
          onChange={(next) => set("isPopular", next)}
          label="Highlight as most popular"
          hint="Adds the badge on the public plans page."
        />
      </div>
    </div>
  )
}

function Toggle({
  id,
  checked,
  disabled,
  onChange,
  label,
  hint,
}: {
  id: string
  checked: boolean
  disabled: boolean
  onChange: (next: boolean) => void
  label: string
  hint: string
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-secondary-50 p-3"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 rounded border-secondary-300"
      />
      <span className="text-sm text-secondary-700">
        {label}
        <span className="mt-0.5 block text-xs text-secondary-500">{hint}</span>
      </span>
    </label>
  )
}
