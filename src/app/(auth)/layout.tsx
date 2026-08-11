/**
 * Auth pages deliberately skip the marketing navbar and footer — nothing should
 * compete with the form once someone has committed to signing in or signing up.
 */
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <main className="min-h-screen">{children}</main>
}
