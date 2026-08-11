import type { Metadata } from "next"

import { MarketsScreen } from "@/components/markets/markets-screen"

export const metadata: Metadata = {
  title: "Markets",
  description: "Live prices across crypto, forex, indices, and commodities.",
  robots: { index: false, follow: false },
}

export default function MarketsPage() {
  return <MarketsScreen />
}
