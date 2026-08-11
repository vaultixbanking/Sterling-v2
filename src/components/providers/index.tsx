"use client"

import { AuthProvider } from "@/components/providers/auth-provider"
import { ToastProvider } from "@/components/ui/toast"

/**
 * Mounted once at the root so the session survives every navigation — including
 * the jump from `(auth)` to `(app)` after signing in, which crosses route groups
 * and would otherwise tear the provider down and re-authenticate.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>{children}</ToastProvider>
    </AuthProvider>
  )
}
