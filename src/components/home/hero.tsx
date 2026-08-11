"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Counter } from "@/components/site/counter"
import { stats } from "@/lib/site"

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
}

export function Hero() {
  return (
    <section className="relative isolate flex min-h-[760px] items-center overflow-hidden lg:min-h-screen">
      <Image
        src="/images/hero.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-center"
      />

      {/* Scrims — navy left-to-right, then top-and-bottom for text legibility */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-linear-to-r from-secondary-900/95 via-secondary-900/80 to-secondary-900/40"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-linear-to-t from-secondary-900 via-transparent to-secondary-900/70"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-32 -z-10 size-[36rem] rounded-full bg-primary-500/25 blur-[120px]"
      />

      <div className="container-px relative w-full pt-28 pb-16 text-white lg:pt-32">
        <div className="max-w-3xl">
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-sm font-medium text-white/90 backdrop-blur-sm"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            Markets live · 1,000+ instruments
          </motion.div>

          <motion.h1
            {...fadeUp}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="mt-6 text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl"
          >
            Trade with the{" "}
            <span className="bg-linear-to-r from-primary-300 via-primary-400 to-primary-200 bg-clip-text text-transparent">
              Sterling Edge
            </span>
          </motion.h1>

          <motion.p
            {...fadeUp}
            transition={{ duration: 0.55, delay: 0.16 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-white/75"
          >
            Forex, crypto, stocks and commodities in one account. Institutional
            tools, spreads from 0.1 pips, and a team that answers when the market
            moves against you.
          </motion.p>

          <motion.div
            {...fadeUp}
            transition={{ duration: 0.55, delay: 0.24 }}
            className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Button asChild size="lg" variant="inverse">
              <Link href="/signup">
                Open Your Account
                <ArrowRight className="transition-transform group-hover/button:translate-x-0.5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghostInverse">
              <Link href="#live-markets">View Live Markets</Link>
            </Button>
          </motion.div>

          <motion.p
            {...fadeUp}
            transition={{ duration: 0.55, delay: 0.3 }}
            className="mt-5 flex items-center gap-2 text-sm text-white/60"
          >
            <ShieldCheck className="size-4 shrink-0 text-primary-300" />
            Segregated client funds · Start from $250 · No deposit fees
          </motion.p>

          {/* Stats strip */}
          <motion.dl
            {...fadeUp}
            transition={{ duration: 0.55, delay: 0.38 }}
            className="mt-12 grid max-w-2xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm sm:grid-cols-4"
          >
            {stats.map((stat) => (
              <div key={stat.label} className="px-5 py-4">
                <dt className="font-heading text-2xl font-bold text-white">
                  <Counter
                    value={stat.value}
                    prefix={stat.prefix}
                    suffix={stat.suffix}
                    decimals={stat.decimals}
                  />
                </dt>
                <dd className="mt-0.5 text-xs text-white/60">{stat.label}</dd>
              </div>
            ))}
          </motion.dl>
        </div>
      </div>
    </section>
  )
}
