import type { Metadata } from "next"

import { baseOpenGraph } from "@/lib/seo"
import { StructuredData } from "@/components/site/structured-data"
import { Hero } from "@/components/home/hero"
import { Ticker } from "@/components/home/ticker"
import { TrustedBy } from "@/components/home/trusted-by"
import { Markets } from "@/components/home/markets"
import { LiveMarkets } from "@/components/home/live-markets"
import { Features } from "@/components/home/features"
import { Platform } from "@/components/home/platform"
import { HowItWorks } from "@/components/home/how-it-works"
import { CopyTrading } from "@/components/home/copy-trading"
import { Plans } from "@/components/home/plans"
import { Testimonials } from "@/components/home/testimonials"
import { Faq } from "@/components/home/faq"
import { Cta } from "@/components/home/cta"

/* Adds the canonical — which is what stops `/`, `/?utm_source=…` and any
   trailing-slash variant counting as separate pages — plus og:url. The base
   Open Graph is respread rather than partially overridden, because a bare
   `openGraph: { url }` here would replace the root's and drop the share image.
   The title is left alone so it keeps the site default rather than being run
   through the `%s | …` template twice. */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { ...baseOpenGraph, url: "/" },
}

export default function Home() {
  return (
    <>
      <StructuredData />
      <Hero />
      <Ticker />
      <TrustedBy />
      <Markets />
      <LiveMarkets />
      <Features />
      <Platform />
      <HowItWorks />
      <CopyTrading />
      <Plans />
      <Testimonials />
      <Faq />
      <Cta />
    </>
  )
}
