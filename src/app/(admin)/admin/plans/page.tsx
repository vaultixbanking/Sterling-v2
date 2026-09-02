import type { Metadata } from "next"

import { AdminPlansScreen } from "@/components/admin/plans-screen"

export const metadata: Metadata = {
  title: "Investment plans",
  description: "Create, edit and retire investment plans.",
  robots: { index: false, follow: false },
}

export default function AdminPlansPage() {
  return <AdminPlansScreen />
}
