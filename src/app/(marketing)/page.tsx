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

export default function Home() {
  return (
    <>
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
