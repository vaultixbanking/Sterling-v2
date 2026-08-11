import type { Metadata } from "next"

import { AdminUserDetailScreen } from "@/components/admin/user-detail-screen"

export const metadata: Metadata = {
  title: "User",
  description: "Account detail and management.",
  robots: { index: false, follow: false },
}

/** `params` is a promise in this version of Next — it must be awaited. */
export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ uid: string }>
}) {
  const { uid } = await params
  return <AdminUserDetailScreen uid={uid} />
}
