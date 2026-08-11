import { AppShell } from "@/components/app/app-shell"

/**
 * Every signed-in user page renders inside the shell.
 *
 * `/welcome` deliberately sits outside this group: onboarding is a one-time
 * full-page moment, and framing it with the nav it is introducing undercuts it.
 */
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <AppShell variant="user">{children}</AppShell>
}
