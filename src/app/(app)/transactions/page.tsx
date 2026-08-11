import type { Metadata } from "next"

import { TransactionsScreen } from "@/components/transactions/transactions-screen"

export const metadata: Metadata = {
  title: "Transactions",
  description: "Your Sterling Edge Trade transaction history.",
  robots: { index: false, follow: false },
}

export default function TransactionsPage() {
  return <TransactionsScreen />
}
