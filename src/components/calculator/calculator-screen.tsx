"use client"

import { useMemo, useState } from "react"
import { Calculator as CalculatorIcon, Info } from "lucide-react"

import { AreaChart } from "@/components/app/area-chart"
import { PageHeader } from "@/components/app/page-header"
import { Input } from "@/components/ui/input"
import { formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Compound-return projection.
 *
 * Entirely client-side and entirely hypothetical — it touches no account data
 * and moves no money. The figures are a projection at a fixed rate, which is
 * not what any real market does; the note under the result says so rather than
 * letting the number imply a promise.
 */
export function CalculatorScreen() {
  const [principal, setPrincipal] = useState("5000")
  const [dailyRate, setDailyRate] = useState("1.2")
  const [days, setDays] = useState("30")
  const [compound, setCompound] = useState(true)

  const result = useMemo(() => {
    const start = Number(principal)
    const rate = Number(dailyRate) / 100
    const term = Math.floor(Number(days))

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(rate) ||
      !Number.isFinite(term) ||
      start <= 0 ||
      term <= 0 ||
      term > 3650
    ) {
      return null
    }

    const points: Array<{ date: string; value: string }> = []
    let balance = start

    for (let day = 1; day <= term; day += 1) {
      balance = compound ? balance * (1 + rate) : start + start * rate * day
      const date = new Date()
      date.setDate(date.getDate() + day)
      points.push({
        date: date.toISOString().slice(0, 10),
        value: balance.toFixed(2),
      })
    }

    return {
      points,
      final: balance.toFixed(2),
      profit: (balance - start).toFixed(2),
      multiple: (balance / start).toFixed(2),
    }
  }, [principal, dailyRate, days, compound])

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Calculator"
        description="Project what a principal could grow to at a fixed daily rate."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="rounded-2xl border border-secondary-100/80 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="space-y-4">
            <Input
              id="calc-principal"
              label="Principal (USD)"
              type="number"
              inputMode="decimal"
              min="0"
              step="100"
              value={principal}
              onChange={(event) => setPrincipal(event.target.value)}
            />
            <Input
              id="calc-rate"
              label="Daily return (%)"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={dailyRate}
              onChange={(event) => setDailyRate(event.target.value)}
            />
            <Input
              id="calc-days"
              label="Days"
              type="number"
              inputMode="numeric"
              min="1"
              max="3650"
              step="1"
              value={days}
              onChange={(event) => setDays(event.target.value)}
            />

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-secondary-700">
                Return type
              </legend>
              <div className="flex gap-2">
                {[
                  { value: true, label: "Compound" },
                  { value: false, label: "Simple" },
                ].map((option) => (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => setCompound(option.value)}
                    aria-pressed={compound === option.value}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors outline-none focus-visible:ring-4 focus-visible:ring-primary-200",
                      compound === option.value
                        ? "border-primary-600 bg-primary-600 text-white"
                        : "border-secondary-200 bg-white text-secondary-700 hover:border-primary-300"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </section>

        <section className="lg:col-span-3">
          {result ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Figure label="Final balance" value={result.final} primary />
                <Figure label="Profit" value={result.profit} />
                <Figure label="Multiple" raw={`${result.multiple}×`} />
              </div>

              <div className="mt-4 rounded-2xl border border-secondary-100/80 bg-white p-5 shadow-sm">
                <h3 className="mb-3 font-heading text-lg font-bold text-secondary-900">
                  Projection
                </h3>
                <AreaChart points={result.points} height={220} />
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-secondary-200 bg-secondary-50/50 px-6 text-center">
              <CalculatorIcon className="mb-3 size-6 text-secondary-400" />
              <p className="font-semibold text-secondary-900">
                Enter your figures
              </p>
              <p className="mt-1 text-sm text-secondary-600">
                Principal and days must be positive, up to 10 years.
              </p>
            </div>
          )}

          <p className="mt-4 flex items-start gap-2 rounded-xl bg-secondary-50 p-3 text-xs leading-relaxed text-secondary-600">
            <Info className="mt-0.5 size-4 shrink-0 text-secondary-400" />
            <span>
              A projection at a constant rate, not a forecast or a guarantee.
              Real returns vary daily and can be negative. This tool does not
              read or change your account.
            </span>
          </p>
        </section>
      </div>
    </div>
  )
}

function Figure({
  label,
  value,
  raw,
  primary = false,
}: {
  label: string
  value?: string
  raw?: string
  primary?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-sm",
        primary
          ? "border-primary-600 bg-primary-600 text-white"
          : "border-secondary-100/80 bg-white"
      )}
    >
      <p
        className={cn(
          "text-xs font-medium",
          primary ? "text-primary-100" : "text-secondary-500"
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-heading text-xl font-bold tabular",
          primary ? "text-white" : "text-secondary-900"
        )}
      >
        {raw ?? formatMoney(value)}
      </p>
    </div>
  )
}
