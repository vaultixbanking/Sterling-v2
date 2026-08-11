import type { Metadata } from "next"

import { AdminAuditLogsScreen } from "@/components/admin/audit-logs-screen"

export const metadata: Metadata = {
  title: "Audit log",
  description: "Administrative action trail.",
  robots: { index: false, follow: false },
}

export default function AdminAuditLogsPage() {
  return <AdminAuditLogsScreen />
}
