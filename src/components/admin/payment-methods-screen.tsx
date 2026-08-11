"use client"

import { useState } from "react"
import { Banknote, Bitcoin, Plus, Smartphone, Trash2 } from "lucide-react"

import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { ErrorState } from "@/components/app/empty-state"
import { PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast"
import * as api from "@/lib/api/endpoints"
import type { BankConfig, CryptoConfig, WalletConfig } from "@/lib/api/types"
import { useAsyncData } from "@/lib/use-async-data"

/** Split out so its initial values can come from `useState`, not an effect. */
function BankForm({
  initial,
  onSaved,
}: {
  initial: BankConfig | null
  onSaved: () => void
}) {
  const toast = useToast()
  const [bank, setBank] = useState({
    bankName: initial?.bankName ?? "",
    accountName: initial?.accountName ?? "",
    accountNumber: initial?.accountNumber ?? "",
    routingNumber: initial?.routingNumber ?? "",
    swiftCode: initial?.swiftCode ?? "",
  })
  const [busy, setBusy] = useState(false)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      await api.admin.saveBank({
        bankName: bank.bankName.trim(),
        accountName: bank.accountName.trim(),
        accountNumber: bank.accountNumber.trim(),
        routingNumber: bank.routingNumber.trim() || undefined,
        swiftCode: bank.swiftCode.trim() || undefined,
        isActive: true,
      })
      toast.success("Bank details saved")
      onSaved()
    } catch (cause) {
      toast.fromError(cause, "Could not save the bank details.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="mt-4 space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="bank-name"
          label="Bank name"
          value={bank.bankName}
          onChange={(e) => setBank((b) => ({ ...b, bankName: e.target.value }))}
          disabled={busy}
        />
        <Input
          id="bank-account-name"
          label="Account name"
          value={bank.accountName}
          onChange={(e) => setBank((b) => ({ ...b, accountName: e.target.value }))}
          disabled={busy}
        />
      </div>
      <Input
        id="bank-account-number"
        label="Account number"
        value={bank.accountNumber}
        onChange={(e) => setBank((b) => ({ ...b, accountNumber: e.target.value }))}
        disabled={busy}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="bank-routing"
          label="Routing number"
          optional
          value={bank.routingNumber}
          onChange={(e) => setBank((b) => ({ ...b, routingNumber: e.target.value }))}
          disabled={busy}
        />
        <Input
          id="bank-swift"
          label="SWIFT / BIC"
          optional
          value={bank.swiftCode}
          onChange={(e) => setBank((b) => ({ ...b, swiftCode: e.target.value }))}
          disabled={busy}
        />
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save bank details"}
      </Button>
    </form>
  )
}

/**
 * Where clients are told to send money.
 *
 * These values drive the deposit page directly, so a typo here becomes a
 * misdirected payment — every field is explicit rather than free text.
 */
export function AdminPaymentMethodsScreen() {
  const toast = useToast()
  const config = useAsyncData(() => api.admin.paymentMethods(), "payment-methods")

  const [crypto, setCrypto] = useState({
    currency: "",
    label: "",
    walletAddress: "",
    network: "",
  })
  const [cryptoBusy, setCryptoBusy] = useState(false)

  const [wallet, setWallet] = useState({
    provider: "",
    handle: "",
    instructions: "",
  })
  const [walletBusy, setWalletBusy] = useState(false)

  const [deleting, setDeleting] = useState<
    { kind: "crypto"; item: CryptoConfig } | { kind: "wallet"; item: WalletConfig } | null
  >(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  async function addCrypto(event: React.FormEvent) {
    event.preventDefault()
    setCryptoBusy(true)
    try {
      await api.admin.saveCryptoWallet({
        currency: crypto.currency.trim().toUpperCase(),
        label: crypto.label.trim(),
        walletAddress: crypto.walletAddress.trim(),
        network: crypto.network.trim(),
        isActive: true,
      })
      toast.success("Wallet saved")
      setCrypto({ currency: "", label: "", walletAddress: "", network: "" })
      config.reload()
    } catch (cause) {
      toast.fromError(cause, "Could not save that wallet.")
    } finally {
      setCryptoBusy(false)
    }
  }

  async function addWallet(event: React.FormEvent) {
    event.preventDefault()
    setWalletBusy(true)
    try {
      await api.admin.saveDigitalWallet({
        provider: wallet.provider.trim(),
        handle: wallet.handle.trim(),
        instructions: wallet.instructions.trim() || undefined,
        isActive: true,
      })
      toast.success("Digital wallet saved")
      setWallet({ provider: "", handle: "", instructions: "" })
      config.reload()
    } catch (cause) {
      toast.fromError(cause, "Could not save that wallet.")
    } finally {
      setWalletBusy(false)
    }
  }

  async function remove() {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      if (deleting.kind === "crypto") {
        await api.admin.deleteCryptoWallet(deleting.item.id)
      } else {
        await api.admin.deleteDigitalWallet(deleting.item.id)
      }
      toast.success("Removed")
      setDeleting(null)
      config.reload()
    } catch (cause) {
      toast.fromError(cause, "Could not remove that entry.")
    } finally {
      setDeleteBusy(false)
    }
  }

  if (config.error && !config.data) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <PageHeader title="Payment methods" />
        <ErrorState title="Could not load payment methods" onRetry={config.reload} />
      </div>
    )
  }

  if (!config.data) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <PageHeader title="Payment methods" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Payment methods"
        description="These details appear on the client deposit page exactly as entered."
      />

      <section className="rounded-2xl border border-secondary-100/80 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 font-heading text-lg font-bold text-secondary-900">
          <Banknote className="size-5 text-primary-600" />
          Bank account
        </h3>

        {/* Keyed on the saved record so the form's initial state comes straight
            from `useState`, rather than being pushed in by an effect after the
            fetch resolves — a save re-keys it and the fields re-seed. */}
        <BankForm
          key={config.data.bank?.id ?? "new"}
          initial={config.data.bank}
          onSaved={config.reload}
        />
      </section>

      <section className="mt-6 rounded-2xl border border-secondary-100/80 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 font-heading text-lg font-bold text-secondary-900">
          <Bitcoin className="size-5 text-primary-600" />
          Crypto wallets
        </h3>

        {config.data.crypto.length > 0 && (
          <ul className="mt-4 space-y-2">
            {config.data.crypto.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-secondary-100 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-secondary-900">
                    {item.label}{" "}
                    <span className="font-normal text-secondary-500">
                      · {item.network}
                    </span>
                  </p>
                  <code className="block truncate font-mono text-xs text-secondary-600">
                    {item.walletAddress}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleting({ kind: "crypto", item })}
                  aria-label={`Remove ${item.label}`}
                  className="shrink-0 rounded-lg p-1.5 text-secondary-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={addCrypto} className="mt-4 space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="crypto-currency"
              label="Currency"
              placeholder="USDT"
              value={crypto.currency}
              onChange={(e) => setCrypto((c) => ({ ...c, currency: e.target.value }))}
              disabled={cryptoBusy}
            />
            <Input
              id="crypto-label"
              label="Label"
              placeholder="USDT (Tether)"
              value={crypto.label}
              onChange={(e) => setCrypto((c) => ({ ...c, label: e.target.value }))}
              disabled={cryptoBusy}
            />
          </div>
          <Input
            id="crypto-address"
            label="Wallet address"
            value={crypto.walletAddress}
            onChange={(e) => setCrypto((c) => ({ ...c, walletAddress: e.target.value }))}
            disabled={cryptoBusy}
          />
          <Input
            id="crypto-network"
            label="Network"
            placeholder="TRC20"
            value={crypto.network}
            onChange={(e) => setCrypto((c) => ({ ...c, network: e.target.value }))}
            disabled={cryptoBusy}
          />
          <Button type="submit" variant="outline" disabled={cryptoBusy}>
            <Plus className="size-4" />
            {cryptoBusy ? "Saving…" : "Add wallet"}
          </Button>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-secondary-100/80 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 font-heading text-lg font-bold text-secondary-900">
          <Smartphone className="size-5 text-primary-600" />
          Digital wallets
        </h3>

        {config.data.digitalWallets.length > 0 && (
          <ul className="mt-4 space-y-2">
            {config.data.digitalWallets.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-secondary-100 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-secondary-900">
                    {item.provider}
                  </p>
                  <p className="truncate text-xs text-secondary-600">{item.handle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleting({ kind: "wallet", item })}
                  aria-label={`Remove ${item.provider}`}
                  className="shrink-0 rounded-lg p-1.5 text-secondary-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={addWallet} className="mt-4 space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="wallet-provider"
              label="Provider"
              placeholder="Cash App"
              value={wallet.provider}
              onChange={(e) => setWallet((w) => ({ ...w, provider: e.target.value }))}
              disabled={walletBusy}
            />
            <Input
              id="wallet-handle"
              label="Handle"
              placeholder="$sterlingedge"
              value={wallet.handle}
              onChange={(e) => setWallet((w) => ({ ...w, handle: e.target.value }))}
              disabled={walletBusy}
            />
          </div>
          <Input
            id="wallet-instructions"
            label="Instructions"
            optional
            placeholder="Include your account UID in the payment note."
            value={wallet.instructions}
            onChange={(e) => setWallet((w) => ({ ...w, instructions: e.target.value }))}
            disabled={walletBusy}
          />
          <Button type="submit" variant="outline" disabled={walletBusy}>
            <Plus className="size-4" />
            {walletBusy ? "Saving…" : "Add wallet"}
          </Button>
        </form>
      </section>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => !deleteBusy && !next && setDeleting(null)}
        title="Remove this payment method?"
        description="Clients will no longer be offered it on the deposit page."
        confirmLabel="Remove"
        tone="danger"
        busy={deleteBusy}
        onConfirm={() => void remove()}
      />
    </div>
  )
}
