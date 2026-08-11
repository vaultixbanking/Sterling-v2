import type { Metadata } from "next"

import { DashboardScreen } from "@/components/dashboard/dashboard-screen"

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your Sterling Edge Trade balances, performance, and activity.",
  robots: { index: false, follow: false },
}

export default function DashboardPage() {
  return <DashboardScreen />
}
