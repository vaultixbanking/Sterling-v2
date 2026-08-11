import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Reveal } from "@/components/site/reveal"
import { Button } from "@/components/ui/button"

export function Cta() {
  return (
    <section className="py-16 sm:py-20">
      <div className="container-px">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-primary-600 via-primary-700 to-primary-800 px-6 py-14 text-center shadow-2xl shadow-primary-600/20 sm:px-12 sm:py-16">
            {/* Decorative circles */}
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 size-64 -translate-y-28 translate-x-24 rounded-full bg-white" />
              <div className="absolute bottom-0 left-0 size-80 translate-y-36 -translate-x-24 rounded-full bg-white" />
            </div>

            <div className="relative z-10 mx-auto max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight text-balance text-white sm:text-4xl">
                Start trading in minutes
              </h2>
              <p className="mt-4 text-base leading-relaxed text-pretty text-white/80 sm:text-lg">
                Open your account today and take your first position across
                forex, crypto, stocks or commodities. From $250, with no deposit
                fees.
              </p>

              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" variant="inverse">
                  <Link href="/signup">
                    Open Your Account
                    <ArrowRight className="transition-transform group-hover/button:translate-x-0.5" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="ghostInverse">
                  <Link href="#live-markets">Explore the Markets</Link>
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
