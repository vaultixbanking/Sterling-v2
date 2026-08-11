import type { Metadata } from "next"

import { PlansScreen } from "@/components/plans/plans-screen"

export const metadata: Metadata = {
  title: "Plans",
  description: "Choose an investment plan that matches your capital.",
  robots: { index: false, follow: false },
}

export default function PlansPage() {
  return <PlansScreen />
}
