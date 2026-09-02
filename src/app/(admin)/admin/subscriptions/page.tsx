import type { Metadata } from "next"

import { AdminSubscriptionsScreen } from "@/components/admin/subscriptions-screen"

export const metadata: Metadata = {
  title: "Subscriptions",
  description: "Every plan subscription on the platform.",
  robots: { index: false, follow: false },
}

export default function AdminSubscriptionsPage() {
  return <AdminSubscriptionsScreen />
}
