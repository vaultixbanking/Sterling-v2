import type { Metadata } from "next"

import { WithdrawScreen } from "@/components/withdraw/withdraw-screen"

export const metadata: Metadata = {
  title: "Withdraw",
  description: "Withdraw funds from your Sterling Edge Trade account.",
  robots: { index: false, follow: false },
}

export default function WithdrawPage() {
  return <WithdrawScreen />
}
