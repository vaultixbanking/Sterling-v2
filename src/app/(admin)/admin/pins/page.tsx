import type { Metadata } from "next"

import { AdminPinsScreen } from "@/components/admin/pins-screen"

export const metadata: Metadata = {
  title: "Withdrawal PINs",
  description: "Manage issued PINs.",
  robots: { index: false, follow: false },
}

export default function AdminPinsPage() {
  return <AdminPinsScreen />
}
