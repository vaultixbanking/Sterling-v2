import type { Metadata } from "next"

import { CalculatorScreen } from "@/components/calculator/calculator-screen"

export const metadata: Metadata = {
  title: "Calculator",
  description: "Project returns at a fixed daily rate.",
  robots: { index: false, follow: false },
}

export default function CalculatorPage() {
  return <CalculatorScreen />
}
