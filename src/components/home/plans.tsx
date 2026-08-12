import Link from "next/link"
import { Check, Info } from "lucide-react"

import { cn } from "@/lib/utils"
import { Section } from "@/components/site/section"
import { SectionHeading } from "@/components/site/section-heading"
import { Reveal } from "@/components/site/reveal"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { depositMethods, plans } from "@/lib/site"

export function Plans() {
  return (
    <Section
      id="plans"
      className="bg-linear-to-b from-primary-50 to-white"
    >
      <Reveal>
        <SectionHeading
          title="Pick the tier that matches your capital"
          description="Every plan opens the same four markets. What changes is your rate, your term, and how much of our team's attention comes with it."
        />
      </Reveal>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan, i) => (
          <Reveal key={plan.name} delay={i * 0.08}>
            <Card
              variant={plan.popular ? "featured" : "default"}
              className="flex h-full flex-col"
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary-600 px-3 py-1 text-[10px] font-bold tracking-wider text-white uppercase shadow-lg">
                  Most popular
                </span>
              )}

              <div className="relative z-10 flex flex-1 flex-col">
                <h3 className="font-heading text-xl font-bold text-secondary-900">
                  {plan.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary-600">
                  {plan.description}
                </p>

                <div className="mt-6 flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      "tabular font-heading text-4xl font-bold tracking-tight",
                      plan.popular ? "text-primary-600" : "text-secondary-900"
                    )}
                  >
                    {plan.dailyReturn}
                  </span>
                  <span className="text-sm font-medium text-secondary-500">
                    / day
                  </span>
                </div>
                <p className="mt-1 text-sm text-secondary-500">
                  over {plan.duration}
                </p>

                <dl className="mt-6 space-y-2 rounded-xl bg-secondary-50 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-secondary-500">Minimum</dt>
                    <dd className="tabular font-semibold text-secondary-900">
                      {plan.minDeposit}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-secondary-500">Maximum</dt>
                    <dd className="tabular font-semibold text-secondary-900">
                      {plan.maxDeposit}
                    </dd>
                  </div>
                </dl>

                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm text-secondary-600"
                    >
                      <Check className="mt-0.5 size-4 shrink-0 text-primary-600" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  variant={plan.popular ? "gradient" : "outline"}
                  className="mt-7 w-full"
                >
                  <Link href="/signup">Choose {plan.name}</Link>
                </Button>
              </div>
            </Card>
          </Reveal>
        ))}
      </div>

      {/* Deposit methods */}
      <Reveal delay={0.1}>
        <div className="mt-12 rounded-2xl border border-secondary-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-secondary-900">
                Fund your account, your way
              </h3>
              <p className="mt-1.5 text-sm text-secondary-600">
                No deposit fees on any method. Most clear within minutes.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              {depositMethods.map((method) => (
                <span
                  key={method.label}
                  className="inline-flex items-center gap-2 rounded-lg border border-secondary-200 bg-secondary-50 px-3.5 py-2 text-sm font-medium text-secondary-700"
                >
                  <method.icon className="size-4 text-primary-600" />
                  {method.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.15}>
        <p className="mx-auto mt-6 flex max-w-3xl items-start justify-center gap-2 text-center text-xs leading-relaxed text-secondary-500">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>
            Return rates shown are illustrative targets, not guarantees. Trading
            carries risk and your capital is at risk. Read the full risk
            disclosure before investing.
          </span>
        </p>
      </Reveal>
    </Section>
  )
}
