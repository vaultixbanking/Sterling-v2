"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  KeyRound,
  MinusCircle,
  PlusCircle,
  ShieldOff,
  ShieldCheck,
  Trash2,
} from "lucide-react"

import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { ErrorState } from "@/components/app/empty-state"
import { Money } from "@/components/app/money"
import { PageHeader } from "@/components/app/page-header"
import { StatusBadge } from "@/components/app/status-badge"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/ui/copy-button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast"
import * as api from "@/lib/api/endpoints"
import type { HoldingSummary, IssuedPin, TxCategory } from "@/lib/api/types"
import {
  formatDateTime,
  formatRelative,
  formatUnits,
  humanise,
} from "@/lib/format"
import { useAsyncData } from "@/lib/use-async-data"

/**
 * Everything about one account, in one place.
 *
 * SwiftEdge split this across two screens — "Manage Holdings" and "Add Profits"
 * — each with its own user-search box hitting the same endpoint and each
 * showing the same three balances. They are one page here.
 */
export function AdminUserDetailScreen({ uid }: { uid: string }) {
  const toast = useToast()
  const detail = useAsyncData(() => api.admin.user(uid), `admin-user:${uid}`)

  const [adjustOpen, setAdjustOpen] = useState<"credit" | "debit" | null>(null)
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<TxCategory>("ADJUSTMENT")
  const [busy, setBusy] = useState(false)

  const [statusOpen, setStatusOpen] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)

  const [pinOpen, setPinOpen] = useState(false)
  const [pinLength, setPinLength] = useState<4 | 6>(6)
  const [pinBusy, setPinBusy] = useState(false)
  const [issued, setIssued] = useState<IssuedPin | null>(null)

  const [holdingOpen, setHoldingOpen] = useState(false)
  const [holding, setHolding] = useState({
    name: "",
    symbol: "",
    units: "",
    valueUsd: "",
    creditLedger: false,
  })
  const [holdingBusy, setHoldingBusy] = useState(false)
  const [removing, setRemoving] = useState<HoldingSummary | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)

  const data = detail.data

  async function submitAdjustment() {
    if (!adjustOpen) return
    const numeric = Number(amount)
    if (!Number.isFinite(numeric) || numeric <= 0) {
      toast.error("Enter an amount greater than zero.")
      return
    }

    setBusy(true)
    try {
      await api.admin.adjust(uid, {
        direction: adjustOpen,
        amount: numeric,
        category,
        description: description.trim() || undefined,
      })
      toast.success(
        adjustOpen === "credit" ? "Account credited" : "Account debited"
      )
      setAdjustOpen(null)
      setAmount("")
      setDescription("")
      detail.reload()
    } catch (cause) {
      toast.fromError(cause, "Could not adjust the balance.")
    } finally {
      setBusy(false)
    }
  }

  async function toggleStatus() {
    if (!data) return
    const next = data.user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"
    setStatusBusy(true)
    try {
      await api.admin.setUserStatus(uid, next)
      toast.success(next === "ACTIVE" ? "Account activated" : "Account suspended")
      setStatusOpen(false)
      detail.reload()
    } catch (cause) {
      toast.fromError(cause, "Could not change the account status.")
    } finally {
      setStatusBusy(false)
    }
  }

  async function issuePin() {
    setPinBusy(true)
    try {
      const result = await api.admin.issuePin(uid, {
        length: pinLength,
        ttlMinutes: 1440,
        notifyUser: false,
      })
      // Shown once, here. Never logged — SwiftEdge printed issued PINs to the
      // browser console, where they persisted in the devtools history.
      setIssued(result)
      setPinOpen(false)
    } catch (cause) {
      toast.fromError(cause, "Could not issue a PIN.")
    } finally {
      setPinBusy(false)
    }
  }

  async function addHolding() {
    const units = Number(holding.units)
    const value = Number(holding.valueUsd)
    if (!holding.name.trim() || !holding.symbol.trim()) {
      toast.error("Enter a name and symbol.")
      return
    }
    if (!Number.isFinite(units) || units <= 0 || !Number.isFinite(value) || value <= 0) {
      toast.error("Units and value must be greater than zero.")
      return
    }

    setHoldingBusy(true)
    try {
      await api.admin.addHolding(uid, {
        name: holding.name.trim(),
        symbol: holding.symbol.trim().toUpperCase(),
        units,
        valueUsd: value,
        creditLedger: holding.creditLedger,
      })
      toast.success("Holding added")
      setHoldingOpen(false)
      setHolding({ name: "", symbol: "", units: "", valueUsd: "", creditLedger: false })
      detail.reload()
    } catch (cause) {
      toast.fromError(cause, "Could not add the holding.")
    } finally {
      setHoldingBusy(false)
    }
  }

  async function removeHolding() {
    if (!removing) return
    setRemoveBusy(true)
    try {
      await api.admin.archiveHolding(removing.id)
      toast.success("Holding removed")
      setRemoving(null)
      detail.reload()
    } catch (cause) {
      toast.fromError(cause, "Could not remove the holding.")
    } finally {
      setRemoveBusy(false)
    }
  }

  if (detail.error && !data) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <BackLink />
        <ErrorState
          title="Could not load this user"
          description="The UID may not exist."
          onRetry={detail.reload}
        />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <BackLink />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }

  const suspended = data.user.status === "SUSPENDED"

  return (
    <div className="mx-auto w-full max-w-6xl">
      <BackLink />

      <PageHeader
        title={data.user.fullName}
        description={data.user.email}
        actions={
          <>
            <Button size="sm" onClick={() => setAdjustOpen("credit")}>
              <PlusCircle className="size-4" />
              Credit
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAdjustOpen("debit")}>
              <MinusCircle className="size-4" />
              Debit
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPinOpen(true)}>
              <KeyRound className="size-4" />
              Issue PIN
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={suspended ? "text-emerald-700" : "text-red-600"}
              onClick={() => setStatusOpen(true)}
            >
              {suspended ? (
                <ShieldCheck className="size-4" />
              ) : (
                <ShieldOff className="size-4" />
              )}
              {suspended ? "Activate" : "Suspend"}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Balance label="Balance" value={data.balance.balance} primary />
        <Balance label="Available" value={data.balance.available} />
        <Balance label="Reserved" value={data.balance.reserved} />
      </div>

      <section className="mt-6 rounded-2xl border border-secondary-100/80 bg-white p-5 shadow-sm">
        <h3 className="font-heading text-lg font-bold text-secondary-900">
          Identity
        </h3>
        <dl className="mt-3 grid gap-x-8 gap-y-1 sm:grid-cols-2">
          <Row label="UID" value={data.user.uid} copyable />
          <Row label="Username" value={data.user.username} />
          <Row label="Phone" value={data.user.phone ?? "—"} />
          <Row label="Role" value={data.user.role} />
          <Row
            label="Last seen"
            value={
              data.user.lastLoginAt ? formatRelative(data.user.lastLoginAt) : "Never"
            }
          />
          <Row label="Last IP" value={data.user.lastLoginIp ?? "—"} />
          <Row label="Joined" value={formatDateTime(data.user.createdAt)} />
          <div className="flex items-center justify-between gap-3 border-b border-secondary-100 py-2.5">
            <dt className="text-sm text-secondary-500">Status</dt>
            <dd>
              <StatusBadge status={data.user.status} />
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-2xl border border-secondary-100/80 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-heading text-lg font-bold text-secondary-900">
            Holdings
          </h3>
          <Button size="sm" variant="outline" onClick={() => setHoldingOpen(true)}>
            <PlusCircle className="size-4" />
            Add
          </Button>
        </div>

        {data.holdings.length === 0 ? (
          <p className="mt-3 text-sm text-secondary-500">No holdings.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.holdings.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-secondary-100 p-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-50 text-xs font-bold text-primary-700">
                  {item.symbol.slice(0, 4).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-secondary-900">
                    {item.name}
                  </p>
                  <p className="text-xs text-secondary-500 tabular">
                    {formatUnits(item.units)} {item.symbol.toUpperCase()}
                  </p>
                </div>
                <Money value={item.valueUsd} className="text-sm font-semibold" />
                <button
                  type="button"
                  onClick={() => setRemoving(item)}
                  aria-label={`Remove ${item.name}`}
                  className="shrink-0 rounded-lg p-1.5 text-secondary-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.subscriptions.length > 0 && (
        <section className="mt-6 rounded-2xl border border-secondary-100/80 bg-white p-5 shadow-sm">
          <h3 className="font-heading text-lg font-bold text-secondary-900">
            Subscriptions
          </h3>
          <ul className="mt-3 space-y-2">
            {data.subscriptions.map((sub) => (
              <li
                key={sub.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-secondary-100 p-3 text-sm"
              >
                <span className="font-semibold text-secondary-900">
                  {sub.planName}
                </span>
                <span className="text-secondary-600">
                  <Money value={sub.principal} /> principal ·{" "}
                  <Money value={sub.totalAccrued} /> accrued
                </span>
                <StatusBadge status={sub.status} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 rounded-2xl border border-secondary-100/80 bg-white p-5 shadow-sm">
        <h3 className="font-heading text-lg font-bold text-secondary-900">
          Recent transactions
        </h3>
        {data.recentTransactions.length === 0 ? (
          <p className="mt-3 text-sm text-secondary-500">Nothing yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-secondary-100">
            {data.recentTransactions.map((tx) => (
              <li key={tx.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-secondary-900">
                    {tx.description ?? humanise(tx.category)}
                  </p>
                  <p className="text-xs text-secondary-500 tabular">
                    {formatDateTime(tx.createdAt)}
                  </p>
                </div>
                <StatusBadge status={tx.status} />
                <Money
                  value={tx.type === "DEBIT" ? `-${tx.amount}` : tx.amount}
                  signed
                  className="shrink-0 text-sm font-semibold"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- dialogs ---- */}

      <ConfirmDialog
        open={adjustOpen !== null}
        onOpenChange={(next) => !busy && !next && setAdjustOpen(null)}
        title={adjustOpen === "credit" ? "Credit this account" : "Debit this account"}
        description={
          adjustOpen === "credit"
            ? "Adds funds to the user's balance and writes a ledger entry."
            : "Removes funds from the user's balance and writes a ledger entry."
        }
        confirmLabel={adjustOpen === "credit" ? "Credit" : "Debit"}
        busy={busy}
        onConfirm={() => void submitAdjustment()}
      >
        <div className="space-y-3">
          <Input
            id="adjust-amount"
            label="Amount (USD)"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={busy}
          />
          <div>
            <label
              htmlFor="adjust-category"
              className="mb-2 block text-sm font-medium text-secondary-700"
            >
              Category
            </label>
            <select
              id="adjust-category"
              value={category}
              disabled={busy}
              onChange={(event) => setCategory(event.target.value as TxCategory)}
              className="h-11 w-full rounded-lg border-2 border-secondary-200 bg-white px-3 text-sm outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
            >
              <option value="ADJUSTMENT">Adjustment</option>
              <option value="PROFIT">Profit</option>
              <option value="DEPOSIT">Deposit</option>
              <option value="PLAN_PAYOUT">Plan payout</option>
            </select>
          </div>
          <Input
            id="adjust-description"
            label="Description"
            optional
            placeholder="Shown on the user's transaction list"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={busy}
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={statusOpen}
        onOpenChange={(next) => !statusBusy && setStatusOpen(next)}
        title={suspended ? "Activate this account?" : "Suspend this account?"}
        description={
          suspended
            ? "The user will be able to sign in and transact again."
            : "The user will be blocked from signing in. Existing balances are untouched."
        }
        confirmLabel={suspended ? "Activate" : "Suspend"}
        tone={suspended ? "default" : "danger"}
        busy={statusBusy}
        onConfirm={() => void toggleStatus()}
      />

      <ConfirmDialog
        open={pinOpen}
        onOpenChange={(next) => !pinBusy && setPinOpen(next)}
        title="Issue a withdrawal PIN"
        description="The PIN is shown once, here. It cannot be retrieved afterwards — copy it before closing."
        confirmLabel="Issue PIN"
        busy={pinBusy}
        onConfirm={() => void issuePin()}
      >
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-secondary-700">
            Length
          </legend>
          <div className="flex gap-2">
            {([4, 6] as const).map((length) => (
              <button
                key={length}
                type="button"
                onClick={() => setPinLength(length)}
                aria-pressed={pinLength === length}
                className={
                  pinLength === length
                    ? "flex-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white"
                    : "flex-1 rounded-lg border border-secondary-200 px-3 py-2 text-sm font-semibold text-secondary-700"
                }
              >
                {length} digits
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-secondary-500">Valid for 24 hours.</p>
        </fieldset>
      </ConfirmDialog>

      <ConfirmDialog
        open={issued !== null}
        onOpenChange={(next) => !next && setIssued(null)}
        title="PIN issued"
        description="This will not be shown again. Give it to the user through a channel you trust."
        confirmLabel="Done"
        cancelLabel="Close"
        onConfirm={() => setIssued(null)}
      >
        {issued && (
          <div className="rounded-xl border-2 border-primary-200 bg-primary-50 p-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-3xl font-bold tracking-[0.3em] text-primary-800">
                {issued.pin}
              </span>
              <CopyButton value={issued.pin} label="Copy PIN" />
            </div>
            <p className="mt-2 text-xs text-secondary-600">
              For {issued.user.fullName} · expires{" "}
              {formatDateTime(issued.expiresAt)}
            </p>
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={holdingOpen}
        onOpenChange={(next) => !holdingBusy && setHoldingOpen(next)}
        title="Add a holding"
        confirmLabel="Add holding"
        busy={holdingBusy}
        onConfirm={() => void addHolding()}
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              id="holding-name"
              label="Name"
              placeholder="Bitcoin"
              value={holding.name}
              onChange={(event) =>
                setHolding((h) => ({ ...h, name: event.target.value }))
              }
              disabled={holdingBusy}
            />
            <Input
              id="holding-symbol"
              label="Symbol"
              placeholder="BTC"
              value={holding.symbol}
              onChange={(event) =>
                setHolding((h) => ({ ...h, symbol: event.target.value }))
              }
              disabled={holdingBusy}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              id="holding-units"
              label="Units"
              type="number"
              step="0.00000001"
              value={holding.units}
              onChange={(event) =>
                setHolding((h) => ({ ...h, units: event.target.value }))
              }
              disabled={holdingBusy}
            />
            <Input
              id="holding-value"
              label="Value (USD)"
              type="number"
              step="0.01"
              value={holding.valueUsd}
              onChange={(event) =>
                setHolding((h) => ({ ...h, valueUsd: event.target.value }))
              }
              disabled={holdingBusy}
            />
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-secondary-50 p-3">
            <input
              type="checkbox"
              checked={holding.creditLedger}
              disabled={holdingBusy}
              onChange={(event) =>
                setHolding((h) => ({ ...h, creditLedger: event.target.checked }))
              }
              className="mt-0.5 size-4 rounded border-secondary-300"
            />
            <span className="text-sm text-secondary-700">
              Also credit the cash balance
              <span className="block text-xs text-secondary-500">
                Leave off to record a position the user already funded.
              </span>
            </span>
          </label>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(next) => !removeBusy && !next && setRemoving(null)}
        title="Remove this holding?"
        description={
          removing
            ? `${removing.name} (${formatUnits(removing.units)} ${removing.symbol.toUpperCase()}) will be archived.`
            : undefined
        }
        confirmLabel="Remove"
        tone="danger"
        busy={removeBusy}
        onConfirm={() => void removeHolding()}
      />
    </div>
  )
}

function BackLink() {
  return (
    <Link
      href="/admin/users"
      className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-secondary-600 transition-colors hover:text-primary-600"
    >
      <ArrowLeft className="size-4" />
      All users
    </Link>
  )
}

function Balance({
  label,
  value,
  primary = false,
}: {
  label: string
  value: string
  primary?: boolean
}) {
  return (
    <div
      className={
        primary
          ? "rounded-2xl border border-primary-600 bg-primary-600 p-4 text-white shadow-sm"
          : "rounded-2xl border border-secondary-100/80 bg-white p-4 shadow-sm"
      }
    >
      <p className={primary ? "text-sm text-primary-100" : "text-sm text-secondary-600"}>
        {label}
      </p>
      <p
        className={
          primary
            ? "mt-1 font-heading text-2xl font-bold text-white tabular"
            : "mt-1 font-heading text-2xl font-bold text-secondary-900 tabular"
        }
      >
        <Money value={value} />
      </p>
    </div>
  )
}

function Row({
  label,
  value,
  copyable = false,
}: {
  label: string
  value: string
  copyable?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-secondary-100 py-2.5">
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
