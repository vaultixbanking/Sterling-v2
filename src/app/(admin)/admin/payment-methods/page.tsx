import type { Metadata } from "next"

import { AdminPaymentMethodsScreen } from "@/components/admin/payment-methods-screen"

export const metadata: Metadata = {
  title: "Payment methods",
  description: "Configure deposit destinations.",
  robots: { index: false, follow: false },
}

export default function AdminPaymentMethodsPage() {
  return <AdminPaymentMethodsScreen />
}
