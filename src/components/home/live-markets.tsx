import { Info } from "lucide-react"

import { Section } from "@/components/site/section"
import { SectionHeading } from "@/components/site/section-heading"
import { Reveal } from "@/components/site/reveal"
import { TradingViewWidget } from "@/components/tradingview/widget"

export function LiveMarkets() {
  return (
    <Section id="live-markets" className="bg-white">
      <Reveal>
        <SectionHeading
          eyebrow="Live data"
          title="Real prices, updated continuously"
          description="The same market data our traders act on, streamed straight from the exchanges. Switch tabs to move between asset classes."
        />
      </Reveal>

      <Reveal delay={0.1}>
        <div className="mt-12 overflow-hidden rounded-2xl border border-secondary-200 bg-white shadow-sm">
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
              height: "560",
              plotLineColorGrowing: "rgba(37, 99, 235, 1)",
              plotLineColorFalling: "rgba(239, 68, 68, 1)",
              gridLineColor: "rgba(226, 232, 240, 1)",
              scaleFontColor: "rgba(100, 116, 139, 1)",
              belowLineFillColorGrowing: "rgba(37, 99, 235, 0.12)",
              belowLineFillColorFalling: "rgba(239, 68, 68, 0.12)",
              belowLineFillColorGrowingBottom: "rgba(37, 99, 235, 0)",
              belowLineFillColorFallingBottom: "rgba(239, 68, 68, 0)",
              symbolActiveColor: "rgba(219, 234, 254, 1)",
              tabs: [
                {
                  title: "Forex",
                  symbols: [
                    { s: "FX:EURUSD", d: "EUR to USD" },
                    { s: "FX:GBPUSD", d: "GBP to USD" },
                    { s: "FX:USDJPY", d: "USD to JPY" },
                    { s: "FX:USDCHF", d: "USD to CHF" },
                    { s: "FX:AUDUSD", d: "AUD to USD" },
                    { s: "FX:USDCAD", d: "USD to CAD" },
                  ],
                  originalTitle: "Forex",
                },
                {
                  title: "Crypto",
                  symbols: [
                    { s: "BITSTAMP:BTCUSD", d: "Bitcoin" },
                    { s: "BITSTAMP:ETHUSD", d: "Ethereum" },
                    { s: "BINANCE:SOLUSDT", d: "Solana" },
                    { s: "BINANCE:XRPUSDT", d: "XRP" },
                    { s: "BINANCE:ADAUSDT", d: "Cardano" },
                    { s: "BINANCE:DOGEUSDT", d: "Dogecoin" },
                  ],
                  originalTitle: "Crypto",
                },
                {
                  title: "Stocks",
                  symbols: [
                    { s: "NASDAQ:AAPL", d: "Apple" },
                    { s: "NASDAQ:MSFT", d: "Microsoft" },
                    { s: "NASDAQ:TSLA", d: "Tesla" },
                    { s: "NASDAQ:AMZN", d: "Amazon" },
                    { s: "NASDAQ:GOOGL", d: "Alphabet" },
                    { s: "NASDAQ:NVDA", d: "NVIDIA" },
                  ],
                  originalTitle: "Stocks",
                },
                {
                  title: "Commodities",
                  symbols: [
                    { s: "TVC:GOLD", d: "Gold" },
                    { s: "TVC:SILVER", d: "Silver" },
                    { s: "TVC:USOIL", d: "Crude Oil" },
                    { s: "TVC:UKOIL", d: "Brent Oil" },
                    { s: "CAPITALCOM:NATURALGAS", d: "Natural Gas" },
                    { s: "TVC:PLATINUM", d: "Platinum" },
                  ],
                  originalTitle: "Commodities",
                },
              ],
            }}
          />
        </div>
      </Reveal>

      <Reveal delay={0.15}>
        <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-secondary-500">
          <Info className="size-4 shrink-0" />
          Market data is provided by TradingView and may be delayed. Prices are
          indicative only.
        </p>
      </Reveal>
    </Section>
  )
}
