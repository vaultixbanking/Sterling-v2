import type { Metadata } from "next"

import { AdminUsersScreen } from "@/components/admin/users-screen"

export const metadata: Metadata = {
  title: "Users",
  description: "Manage client accounts.",
  robots: { index: false, follow: false },
}

export default function AdminUsersPage() {
  return <AdminUsersScreen />
}
