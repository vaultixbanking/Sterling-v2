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
import { cn } from "@/lib/utils"

type Direction = "credit" | "debit"

/**
 * What an admin may write by hand — mirrors ADJUSTABLE_CATEGORIES on the API.
 *
 * Direction and category are two separate columns on the ledger. The button
 * decides `type` (money in or out); this list decides `category` (the reason
 * printed on the user's statement). Both directions are valid for every entry
 * here — a credit records the thing, a debit reverses it — so each carries two
 * labels. "Debit + Profit" reads as a contradiction until it is spelled out as
 * "reverse a profit", which is exactly what it is.
 */
const CATEGORY_OPTIONS: ReadonlyArray<{
  value: TxCategory
  credit: string
  debit: string
  /** Dashboard figure this moves on top of the balance, if any. */
  affects: string | null
}> = [
  {
    value: "ADJUSTMENT",
    credit: "Adjustment — balance only",
    debit: "Correction — balance only",
    affects: null,
  },
  {
    value: "DEPOSIT",
    credit: "Deposit",
    debit: "Reverse a deposit",
    affects: "Invested capital",
  },
  {
    value: "HOLDING",
    credit: "Holding value",
    debit: "Reverse a holding credit",
    affects: "Invested capital",
  },
  {
    value: "PROFIT",
    credit: "Profit",
    debit: "Reverse a profit",
    affects: "Profit earned",
  },
  {
    value: "PLAN_PAYOUT",
    credit: "Plan payout",
    debit: "Reverse a plan payout",
    affects: "Profit earned",
  },
]

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

  const [adjustOpen, setAdjustOpen] = useState<Direction | null>(null)
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<TxCategory>("ADJUSTMENT")
  const [notify, setNotify] = useState(true)
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
    // On by default: most positions recorded here are money the user actually
    // sent — a manual bank transfer or wallet payment they expect the desk to
    // book for them. Recording the asset without the cash was the wrong
    // default, and left the balance disagreeing with what they had paid.
    creditLedger: true,
  })
  const [holdingBusy, setHoldingBusy] = useState(false)
  const [removing, setRemoving] = useState<HoldingSummary | null>(null)
  const [reverseHolding, setReverseHolding] = useState(true)
  const [notifyHolding, setNotifyHolding] = useState(false)
  const [removeBusy, setRemoveBusy] = useState(false)

  const data = detail.data

  function openAdjust(direction: Direction) {
    // Reset everything. The category persisted across openings, so switching
    // Credit → Debit kept the previous reason on screen and made "Adjustment"
    // look like it was itself the direction.
    setAmount("")
    setDescription("")
    setCategory("ADJUSTMENT")
    // Credit notifies by default, debit does not — money arriving is news the
    // user wants, money leaving is usually a correction being made moments
    // later. Reset per opening either way, so a choice made about the last
    // entry never carries silently into this one.
    setNotify(direction === "credit")
    setAdjustOpen(direction)
  }

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
        notify,
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
      setHolding({
        name: "",
        symbol: "",
        units: "",
        valueUsd: "",
        creditLedger: true,
      })
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
      const result = await api.admin.archiveHolding(
        removing.id,
        reverseHolding,
        reverseHolding && notifyHolding
      )
      toast.success(
        "Holding removed",
        result.reversed
          ? "The credit it added has been reversed."
          : "The balance was left as it is."
      )
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

  const holdingValue = Number(holding.valueUsd)
  const holdingValueLabel =
    Number.isFinite(holdingValue) && holdingValue > 0
      ? `$${holdingValue.toFixed(2)}`
      : "its value"

  return (
    <div className="mx-auto w-full max-w-6xl">
      <BackLink />

      <PageHeader
        title={data.user.fullName}
        description={data.user.email}
        actions={
          <>
            <Button size="sm" onClick={() => openAdjust("credit")}>
              <PlusCircle className="size-4" />
              Credit
            </Button>
            <Button size="sm" variant="outline" onClick={() => openAdjust("debit")}>
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
                  onClick={() => {
                    // Reset alongside the target, for the same reason the
                    // adjustment category resets: a choice made about the last
                    // position must not silently carry into this one.
                    setReverseHolding(true)
                    setNotifyHolding(false)
                    setRemoving(item)
                  }}
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
        title={
          adjustOpen === "credit" ? "Credit this account" : "Debit this account"
        }
        description={
          adjustOpen === "credit"
            ? "Money in. Raises the balance and appears on the user's statement."
            : "Money out. Lowers the balance and appears on the user's statement."
        }
        confirmLabel={adjustOpen === "credit" ? "Credit" : "Debit"}
        tone={adjustOpen === "debit" ? "danger" : "default"}
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
              {adjustOpen === "credit"
                ? "What is this for?"
                : "What are you reversing?"}
            </label>
            <select
              id="adjust-category"
              value={category}
              disabled={busy}
              onChange={(event) => setCategory(event.target.value as TxCategory)}
              className="h-11 w-full rounded-lg border-2 border-secondary-200 bg-white px-3 text-sm outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {adjustOpen === "credit" ? option.credit : option.debit}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-secondary-500">
              Direction is already set by the button you clicked. This only
              labels the reason, and which dashboard figure moves with it.
            </p>
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
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-secondary-50 p-3">
            <input
              type="checkbox"
              checked={notify}
              disabled={busy}
              onChange={(event) => setNotify(event.target.checked)}
              className="mt-0.5 size-4 rounded border-secondary-300"
            />
            <span className="text-sm text-secondary-700">
              {adjustOpen === "credit"
                ? "Email the user about this credit"
                : "Email the user about this debit"}
              <span className="mt-0.5 block text-xs text-secondary-500">
                {notify
                  ? adjustOpen === "debit"
                    ? "They get a notice with the amount, the reason you typed, and how to query it."
                    : category === "PROFIT" || category === "PLAN_PAYOUT"
                      ? "They get the profit notice with the amount and their new balance."
                      : "They get a notice with the amount and their new balance."
                  : "Nothing is sent. Use this for correcting your own mistake."}
              </span>
            </span>
          </label>

          <AdjustmentEffect
            direction={adjustOpen}
            category={category}
            amount={amount}
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
              Also add this to the cash balance
              {/* Both states are spelled out because the difference is money:
                  off, the dashboard lists a position the balance knows nothing
                  about. */}
              <span className="mt-0.5 block text-xs text-secondary-500">
                {holding.creditLedger
                  ? `On — balance rises by ${holdingValueLabel}, and the position is listed on the dashboard.`
                  : "Off — the position is listed on the dashboard only. The balance does not move."}
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
      >
        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-secondary-50 p-3">
          <input
            type="checkbox"
            checked={reverseHolding}
            disabled={removeBusy}
            onChange={(event) => setReverseHolding(event.target.checked)}
            className="mt-0.5 size-4 rounded border-secondary-300"
          />
          <span className="text-sm text-secondary-700">
            Also take back the money it added
            <span className="mt-0.5 block text-xs text-secondary-500">
              {reverseHolding
                ? "Writes a matching debit, so the balance and invested capital both come back down. Nothing happens if the position never credited the balance."
                : "The position goes, the money stays. Use this to write off a position you do not want to claw back."}
            </span>
          </span>
        </label>

        {/* Only when money is actually leaving — there is nothing to announce
            about a position that never credited the balance. */}
        {reverseHolding && (
          <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-lg bg-secondary-50 p-3">
            <input
              type="checkbox"
              checked={notifyHolding}
              disabled={removeBusy}
              onChange={(event) => setNotifyHolding(event.target.checked)}
              className="mt-0.5 size-4 rounded border-secondary-300"
            />
            <span className="text-sm text-secondary-700">
              Email the user about the money coming back out
              <span className="mt-0.5 block text-xs text-secondary-500">
                {notifyHolding
                  ? "They get a notice naming the position, the amount, and how to query it."
                  : "Nothing is sent. Off by default — most reversals are the desk correcting its own entry."}
              </span>
            </span>
          </label>
        )}
      </ConfirmDialog>
    </div>
  )
}

/**
 * Spells out what the two fields will actually do before the admin commits.
 *
 * The dialog previously showed a direction in the title and a category in a
 * dropdown and left the reader to work out how they combined — which is how
 * "Credit" + "Adjustment" got read as meaning adjustments were debits. Stating
 * both movements in one sentence removes the guess.
 */
function AdjustmentEffect({
  direction,
  category,
  amount,
}: {
  direction: Direction | null
  category: TxCategory
  amount: string
}) {
  const numeric = Number(amount)
  if (!direction || !Number.isFinite(numeric) || numeric <= 0) return null

  const option = CATEGORY_OPTIONS.find((item) => item.value === category)
  const verb = direction === "credit" ? "rises" : "falls"
  const figure = `$${numeric.toFixed(2)}`

  return (
    <div
      className={cn(
        "rounded-lg border p-3 text-xs",
        direction === "credit"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-amber-200 bg-amber-50 text-amber-900"
      )}
    >
      <p className="font-semibold">After this:</p>
      <ul className="mt-1 space-y-0.5">
        <li>
          Total balance {verb} by {figure}
        </li>
        {option?.affects && (
          <li>
            {option.affects} {verb} by {figure}
          </li>
        )}
      </ul>
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
