"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

import { useAuth } from "@/components/providers/auth-provider"
import { Logo } from "@/components/logo"

/**
 * Client-side gate for the signed-in areas.
 *
 * This is **UX, not security**. The access token lives in memory, so Next.js
 * middleware cannot see it and this cannot run on the server. The real boundary
 * is the API, which authenticates every request and enforces `requireRole`
 * on the admin routes — a guest who types `/admin` gets bounced here, and if
 * they somehow weren't, every call the page made would still 401 or 403.
 *
 * SwiftEdge had neither: `app.html` and the admin panel both rendered their
 * full UI to anyone with the URL, and only the data was missing.
 */
export function RequireAuth({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode
  adminOnly?: boolean
}) {
  const { status, user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const allowed = status === "authed" && (!adminOnly || user?.role === "ADMIN")

  useEffect(() => {
    if (status === "loading") return

    if (status === "guest") {
      // Remember where they were headed so sign-in can return them there.
      router.replace(`/login?next=${encodeURIComponent(pathname)}`)
      return
    }

    if (adminOnly && user?.role !== "ADMIN") {
      router.replace("/dashboard")
    }
  }, [status, user?.role, adminOnly, pathname, router])

  if (!allowed) return <AuthPending />

  return <>{children}</>
}

/**
 * Shown while the session is being restored, and for the instant between
 * deciding to redirect and the route actually changing.
 */
function AuthPending() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white">
      <Logo showWordmark={false} className="animate-pulse" />
      <p className="text-sm text-secondary-500">Checking your session…</p>
    </div>
  )
}
