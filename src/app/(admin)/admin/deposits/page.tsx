import type { Metadata } from "next"

import { AdminDepositsScreen } from "@/components/admin/deposits-screen"

export const metadata: Metadata = {
  title: "Deposits",
  description: "Review deposit requests.",
  robots: { index: false, follow: false },
}

export default function AdminDepositsPage() {
  return <AdminDepositsScreen />
}
