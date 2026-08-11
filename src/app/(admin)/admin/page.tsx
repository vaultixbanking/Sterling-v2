import type { Metadata } from "next"

import { AdminOverviewScreen } from "@/components/admin/overview-screen"

export const metadata: Metadata = {
  title: "Admin",
  description: "Platform overview.",
  robots: { index: false, follow: false },
}

export default function AdminPage() {
  return <AdminOverviewScreen />
}
