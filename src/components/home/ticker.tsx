import { tickerInstruments } from "@/lib/site"

const categoryDot: Record<string, string> = {
  Forex: "bg-blue-500",
  Crypto: "bg-amber-500",
  Stocks: "bg-indigo-500",
  Commodities: "bg-emerald-500",
}

/**
 * Instrument marquee under the hero. Names only — live pricing is handled by
 * the TradingView market overview further down the page.
 */
export function Ticker() {
  // Duplicated once so the -50% keyframe loops seamlessly.
  const items = [...tickerInstruments, ...tickerInstruments]

  return (
    <div className="border-y border-secondary-100 bg-white py-3.5">
      <div className="mask-fade-x overflow-hidden">
        <div className="animate-marquee flex w-max items-center gap-8">
          {items.map((item, i) => (
            <div
              key={`${item.symbol}-${i}`}
              className="flex shrink-0 items-center gap-2.5"
              aria-hidden={i >= tickerInstruments.length}
            >
              <span
                className={`size-1.5 shrink-0 rounded-full ${categoryDot[item.category]}`}
              />
              <span className="font-mono text-sm font-semibold tracking-tight text-secondary-900">
                {item.symbol}
              </span>
              <span className="text-sm whitespace-nowrap text-secondary-500">
                {item.name}
              </span>
              <span className="ml-2 h-4 w-px bg-secondary-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
