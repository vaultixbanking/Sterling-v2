import type { Metadata } from "next"

import { AdminWithdrawalsScreen } from "@/components/admin/withdrawals-screen"

export const metadata: Metadata = {
  title: "Withdrawals",
  description: "Review withdrawal requests.",
  robots: { index: false, follow: false },
}

export default function AdminWithdrawalsPage() {
  return <AdminWithdrawalsScreen />
}
