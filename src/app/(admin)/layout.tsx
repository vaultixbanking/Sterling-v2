import { AppShell } from "@/components/app/app-shell"

/**
 * The admin panel renders through the same shell as the user app, with the
 * admin nav and a visible role badge.
 *
 * `variant="admin"` also gates on `user.role === "ADMIN"` client-side. That is
 * UX only — the token lives in memory where middleware cannot see it. The real
 * boundary is the API, which applies `authenticate, requireAdmin` to every
 * `/admin` route.
 */
export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <AppShell variant="admin">{children}</AppShell>
}
