import type { Metadata } from "next"

import { SettingsScreen } from "@/components/settings/settings-screen"

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your profile, password, and sessions.",
  robots: { index: false, follow: false },
}

export default function SettingsPage() {
  return <SettingsScreen />
}
