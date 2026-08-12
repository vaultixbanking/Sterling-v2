"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, ShieldCheck, Users, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Counter } from "@/components/site/counter"
import { markets, stats } from "@/lib/site"

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
}

/**
 * No photograph here by design. Every treatment we tried over the trading-desk
 * shot traded legibility against noise — a photo of a screen is illegible at
 * any scrim strength. A gradient ground with vector-sharp cards stays crisp,
 * keeps the page light, and carries the blue palette throughout.
 */
export function Hero() {
  return (
    /* Height is driven by content plus padding rather than `min-h-screen`.
       Centring a short block inside a full-viewport section added its slack on
       top of the padding, which is what opened the gap under the navbar. */
    <section className="relative isolate flex min-h-[620px] items-center overflow-hidden lg:min-h-[700px]">
      {/* Light ground */}
      <div
        aria-hidden
        className="absolute inset-0 -z-20 bg-linear-to-br from-primary-50 via-white to-blue-50"
      />

      {/* Soft colour blooms. `mix-blend-multiply` keeps them tinting the ground
          rather than fogging it the way a plain overlay would. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-24 -left-24 -z-10 size-96 animate-pulse rounded-full bg-primary-200 opacity-25 mix-blend-multiply blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 bottom-8 -z-10 size-80 animate-pulse rounded-full bg-blue-200 opacity-25 mix-blend-multiply blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/3 -z-10 size-64 rounded-full bg-primary-100 opacity-20 mix-blend-multiply blur-2xl"
      />

      {/* Existing dotted utility, dialled right back so it reads as texture */}
      <div aria-hidden className="bg-dotted absolute inset-0 -z-10 opacity-25" />

      {/* pt clears the fixed navbar (h-14 + py-3 = 80px) with a little air */}
      <div className="container-px relative w-full pt-24 pb-16 lg:pt-28 lg:pb-20">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-14">
          {/* ── Copy ── */}
          <div>
            <motion.h1
              {...fadeUp}
              transition={{ duration: 0.55, delay: 0.08 }}
              className="text-4xl leading-[1.05] font-bold tracking-tight text-balance text-secondary-900 sm:text-5xl lg:text-6xl"
            >
              Trade with{" "}
              <span className="bg-linear-to-r from-primary-600 via-primary-500 to-blue-500 bg-clip-text text-transparent">
                Sterling Edge
              </span>
            </motion.h1>

            <motion.p
              {...fadeUp}
              transition={{ duration: 0.55, delay: 0.16 }}
              className="mt-5 max-w-xl text-lg leading-relaxed text-pretty text-secondary-600"
            >
              Forex, crypto, stocks and commodities in one account. Institutional
              tools, spreads from 0.1 pips, and a team that answers when the
              market moves against you.
            </motion.p>

            <motion.div
              {...fadeUp}
              transition={{ duration: 0.55, delay: 0.24 }}
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <Button asChild size="lg" variant="gradient">
                <Link href="/signup">
                  Open Your Account
                  <ArrowRight className="transition-transform group-hover/button:translate-x-0.5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#live-markets">View Live Markets</Link>
              </Button>
            </motion.div>

            <motion.p
              {...fadeUp}
              transition={{ duration: 0.55, delay: 0.3 }}
              className="mt-5 flex items-center gap-2 text-sm text-secondary-500"
            >
              <ShieldCheck className="size-4 shrink-0 text-primary-600" />
              Segregated client funds · Start from $250 · No deposit fees
            </motion.p>

            <motion.dl
              {...fadeUp}
              transition={{ duration: 0.55, delay: 0.38 }}
              /* Four across only from xl — in the half-width column a figure
                 like "10,000+" is wider than a quarter of it and collides with
                 its neighbour. */
              className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6 xl:grid-cols-4"
            >
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dt className="font-heading text-2xl font-bold text-primary-600 xl:text-3xl">
                    <Counter
                      value={stat.value}
                      prefix={stat.prefix}
                      suffix={stat.suffix}
                      decimals={stat.decimals}
                    />
                  </dt>
                  <dd className="mt-1 text-xs text-secondary-500">
                    {stat.label}
                  </dd>
                </div>
              ))}
            </motion.dl>
          </div>

          {/* ── Markets card ── */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.28 }}
            className="relative mx-auto w-full max-w-md lg:mr-0 lg:ml-auto lg:max-w-lg"
          >
            {/* Glow behind the card */}
            <div
              aria-hidden
              className="absolute -inset-4 -z-10 rounded-[2rem] bg-linear-to-r from-primary-400/20 to-blue-400/20 blur-2xl"
            />

            <div className="rounded-3xl border border-secondary-100/80 bg-white p-5 shadow-2xl sm:p-6">
              {/* No badge in this corner — the floating "Funds segregated" chip
                  overlaps here, and the two collided. */}
              <div className="mb-5 flex items-center gap-2">
                <Wallet className="size-4 shrink-0 text-primary-600" />
                <div>
                  <p className="text-xs text-secondary-500">Trade across</p>
                  <p className="font-heading text-lg font-bold text-secondary-900">
                    Four asset classes
                  </p>
                </div>
              </div>

              <ul className="space-y-1">
                {markets.map(
                  ({ name, slug, instruments, spread, icon: Icon, gradient }) => (
                    <li key={slug}>
                      <Link
                        href="#markets"
                        className="group flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-secondary-50"
                      >
                        <span
                          className={`flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br ${gradient} text-white shadow-sm`}
                        >
                          <Icon className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-secondary-900">
                            {name}
                          </span>
                          <span className="block truncate text-xs text-secondary-500">
                            {instruments}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold whitespace-nowrap text-primary-600">
                          {spread}
                        </span>
                      </Link>
                    </li>
                  )
                )}
              </ul>

              <Button asChild className="mt-5 w-full">
                <Link href="#markets">
                  Explore all markets
                  <ArrowRight className="transition-transform group-hover/button:translate-x-0.5" />
                </Link>
              </Button>
            </div>

            {/* Floating proof cards, both drawn from the figures above.
                `pointer-events-none` so they can never eat a click meant for
                the card's button underneath. */}
            <div className="pointer-events-none absolute -top-5 -right-3 hidden items-center gap-2 rounded-xl border border-secondary-100 bg-white p-3 shadow-lg sm:flex lg:-right-6">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
                <ShieldCheck className="size-4 text-emerald-600" />
              </span>
              <span>
                <span className="block text-xs font-semibold text-secondary-900">
                  Funds segregated
                </span>
                <span className="block text-[10px] text-emerald-600">
                  Held at Tier-1 banks
                </span>
              </span>
            </div>

            <div className="pointer-events-none absolute -bottom-7 -left-3 hidden items-center gap-2 rounded-xl border border-secondary-100 bg-white p-3 shadow-lg sm:flex lg:-left-8">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-100">
                <Users className="size-4 text-primary-600" />
              </span>
              <span>
                <span className="block text-xs font-semibold text-secondary-900">
                  10,000+ investors
                </span>
                <span className="block text-[10px] text-primary-600">
                  Across 100+ countries
                </span>
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
