import { Check } from "lucide-react"

import { Section } from "@/components/site/section"
import { SectionHeading } from "@/components/site/section-heading"
import { Reveal } from "@/components/site/reveal"
import { Card } from "@/components/ui/card"
import { TradingViewWidget } from "@/components/tradingview/widget"
import { toolBenefits, tradingTools } from "@/lib/site"

export function Platform() {
  return (
    <Section
      id="platform"
      className="relative overflow-hidden bg-linear-to-br from-primary-900 via-primary-800 to-secondary-900"
    >
      {/* Decorative glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-40 size-[32rem] rounded-full bg-primary-500/20 blur-[120px]"
      />
      <div aria-hidden className="absolute inset-0 bg-dotted opacity-[0.07]" />

      <div className="relative z-10">
        <Reveal>
          <SectionHeading
            invert
            title="Professional-grade tools, included"
            description="Real charting, real risk management, real portfolio analytics. Not screenshots — the same tools our desk uses, wired to your live account."
          />
        </Reveal>

        {/* Live chart */}
        <Reveal delay={0.1}>
          <div className="mt-12 overflow-hidden rounded-2xl border border-white/15 bg-white/5 p-1.5 shadow-2xl backdrop-blur-sm">
            <div className="overflow-hidden rounded-xl">
              <TradingViewWidget
                script="advanced-chart"
                className="h-[420px] sm:h-[500px]"
                skeletonClassName="bg-white/10"
                config={{
                  autosize: true,
                  symbol: "BITSTAMP:BTCUSD",
                  interval: "60",
                  timezone: "Etc/UTC",
                  theme: "dark",
                  style: "1",
                  locale: "en",
                  backgroundColor: "rgba(15, 23, 42, 1)",
                  gridColor: "rgba(255, 255, 255, 0.06)",
                  hide_side_toolbar: true,
                  allow_symbol_change: true,
                  save_image: false,
                  calendar: false,
                  support_host: "https://www.tradingview.com",
                }}
              />
            </div>
          </div>
        </Reveal>

        {/* Tool cards */}
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {tradingTools.map((tool, i) => (
            <Reveal key={tool.title} delay={i * 0.08}>
              <Card variant="glass" className="h-full">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="flex size-12 items-center justify-center rounded-xl border border-white/20 bg-white/10 transition-transform duration-300 group-hover:scale-110">
                    <tool.icon className="size-6 text-primary-300" />
                  </div>
                  {tool.badge && (
                    <span className="rounded-full bg-primary-500/20 px-2.5 py-1 text-[10px] font-bold tracking-wider text-primary-200 uppercase">
                      {tool.badge}
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-bold text-white sm:text-xl">
                  {tool.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-white/70">
                  {tool.description}
                </p>

                <ul className="mt-5 space-y-2">
                  {tool.highlights.map((highlight) => (
                    <li
                      key={highlight}
                      className="flex items-center gap-2 text-sm text-white/80"
                    >
                      <Check className="size-4 shrink-0 text-primary-300" />
                      {highlight}
                    </li>
                  ))}
                </ul>
              </Card>
            </Reveal>
          ))}
        </div>

        {/* Benefits strip */}
        <div className="mt-10 grid gap-6 border-t border-white/10 pt-10 sm:grid-cols-3">
          {toolBenefits.map((benefit, i) => (
            <Reveal key={benefit.title} delay={i * 0.08}>
              <div className="flex gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <benefit.icon className="size-5 text-primary-300" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">{benefit.title}</h4>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/60">
                    {benefit.description}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  )
}
