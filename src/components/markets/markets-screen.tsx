"use client"

import { PageHeader } from "@/components/app/page-header"
import { TradingViewWidget } from "@/components/tradingview/widget"

/**
 * Live market data.
 *
 * SwiftEdge's equivalent was a CoinGecko text list with no error path — a
 * failed fetch left an empty panel with no explanation. These are the same
 * TradingView widgets the landing page uses, which handle their own loading and
 * failure states.
 */
export function MarketsScreen() {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        title="Markets"
        description="Live prices across crypto, forex, indices, and commodities."
      />

      <section className="overflow-hidden rounded-2xl border border-secondary-100/80 bg-white shadow-sm">
        <TradingViewWidget
          script="market-overview"
          className="h-[460px] sm:h-[560px]"
          config={{
            colorTheme: "light",
            dateRange: "12M",
            showChart: true,
            locale: "en",
            largeChartUrl: "",
            isTransparent: false,
            showSymbolLogo: true,
            showFloatingTooltip: true,
            width: "100%",
            height: "100%",
            tabs: [
              {
                title: "Crypto",
                symbols: [
                  { s: "BINANCE:BTCUSDT", d: "Bitcoin" },
                  { s: "BINANCE:ETHUSDT", d: "Ethereum" },
                  { s: "BINANCE:SOLUSDT", d: "Solana" },
                  { s: "BINANCE:XRPUSDT", d: "XRP" },
                ],
              },
              {
                title: "Forex",
                symbols: [
                  { s: "FX:EURUSD", d: "EUR/USD" },
                  { s: "FX:GBPUSD", d: "GBP/USD" },
                  { s: "FX:USDJPY", d: "USD/JPY" },
                  { s: "FX:AUDUSD", d: "AUD/USD" },
                ],
              },
              {
                title: "Indices",
                symbols: [
                  { s: "FOREXCOM:SPXUSD", d: "S&P 500" },
                  { s: "FOREXCOM:NSXUSD", d: "Nasdaq 100" },
                  { s: "FOREXCOM:DJI", d: "Dow 30" },
                ],
              },
              {
                title: "Commodities",
                symbols: [
                  { s: "TVC:GOLD", d: "Gold" },
                  { s: "TVC:SILVER", d: "Silver" },
                  { s: "TVC:USOIL", d: "Crude Oil" },
                ],
              },
            ],
          }}
        />
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-secondary-100/80 bg-white shadow-sm">
        <TradingViewWidget
          script="screener"
          className="h-[520px]"
          config={{
            defaultColumn: "overview",
            screener_type: "crypto_mkt",
            displayCurrency: "USD",
            colorTheme: "light",
            locale: "en",
            isTransparent: false,
            width: "100%",
            height: "100%",
          }}
        />
      </section>
    </div>
  )
}
