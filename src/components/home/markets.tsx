import { ArrowRight } from "lucide-react"
import Link from "next/link"

import { Section } from "@/components/site/section"
import { SectionHeading } from "@/components/site/section-heading"
import { Reveal } from "@/components/site/reveal"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"
import { markets } from "@/lib/site"

export function Markets() {
  return (
    <Section
      id="markets"
      className="bg-linear-to-br from-primary-50 via-white to-blue-50"
    >
      <Reveal>
        <SectionHeading
          title="Four markets. One account."
          description="Move between currencies, digital assets, equities and commodities without ever splitting your capital across platforms."
        />
      </Reveal>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {markets.map((market, i) => (
          <Reveal key={market.slug} delay={i * 0.08}>
            <Card className="flex h-full flex-col">
              {/* Hover tint */}
              <div
                aria-hidden
                className={`absolute inset-0 rounded-2xl bg-linear-to-br ${market.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-[0.04]`}
              />

              <div className="relative z-10 flex flex-1 flex-col">
                <div
                  className={`mb-5 flex size-14 items-center justify-center rounded-xl bg-linear-to-br ${market.gradient} shadow-lg transition-transform duration-300 group-hover:scale-110`}
                >
                  <market.icon className="size-7 text-white" />
                </div>

                <CardTitle className="mb-3 transition-colors group-hover:text-primary-600">
                  {market.name}
                </CardTitle>
                <CardDescription className="flex-1">
                  {market.description}
                </CardDescription>

                <dl className="mt-6 space-y-2 border-t border-secondary-100 pt-4 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-secondary-500">Instruments</dt>
                    <dd className="font-semibold text-secondary-900">
                      {market.instruments}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-secondary-500">Pricing</dt>
                    <dd className="font-semibold text-primary-600">
                      {market.spread}
                    </dd>
                  </div>
                </dl>

                <Link
                  href="#live-markets"
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 transition-colors hover:text-primary-700"
                >
                  See live prices
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </Card>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
