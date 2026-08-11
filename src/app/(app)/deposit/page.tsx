import type { Metadata } from "next"

import { DepositScreen } from "@/components/deposit/deposit-screen"

export const metadata: Metadata = {
  title: "Deposit",
  description: "Fund your Sterling Edge Trade account.",
  robots: { index: false, follow: false },
}

export default function DepositPage() {
  return <DepositScreen />
}
