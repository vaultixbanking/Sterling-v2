"use client"

import { useState, useSyncExternalStore } from "react"
import { usePathname } from "next/navigation"
import { Dialog } from "radix-ui"

import { RequireAuth } from "@/components/app/require-auth"
import { Sidebar } from "@/components/app/sidebar"
import { Topbar } from "@/components/app/topbar"
import { adminNav, titleForPath, userNav } from "@/lib/app-nav"
import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
  toggleCollapsed,
} from "@/lib/sidebar-preference"
import { cn } from "@/lib/utils"

/**
 * The signed-in chrome: a light sidebar, a white content column, and the topbar.
 *
 * Both the user app and the admin panel render through this — they differ only
 * in the nav they pass and the role badge, so there is one shell to keep
 * responsive rather than two that drift apart.
 */
export function AppShell({
  variant,
  children,
}: {
  /**
   * A string rather than the nav array itself: the layouts that render this are
   * Server Components, and each item carries a Lucide icon — a function, which
   * cannot cross the server/client boundary. Only the variant travels; the nav
   * is resolved here, on the client.
   */
  variant: "user" | "admin"
  children: React.ReactNode
}) {
  const adminOnly = variant === "admin"
  const items = adminOnly ? adminNav : userNav
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const collapsed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )

  // The drawer closes itself through `onNavigate` on each link rather than by
  // watching the pathname, so following a link does not cause a second render
  // pass just to put the state back.

  const title = titleForPath(pathname, items)

  return (
    <RequireAuth adminOnly={adminOnly}>
      <div className="flex min-h-screen bg-white">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 hidden shrink-0 transition-[width] duration-200 lg:block",
            collapsed ? "w-[4.5rem]" : "w-64"
          )}
        >
          <Sidebar
            items={items}
            collapsed={collapsed}
            onToggle={toggleCollapsed}
            isAdmin={adminOnly}
          />
        </aside>

        <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-secondary-900/40 backdrop-blur-sm lg:hidden" />
            <Dialog.Content
              className="fixed inset-y-0 left-0 z-50 w-72 outline-none lg:hidden"
              aria-describedby={undefined}
            >
              <Dialog.Title className="sr-only">Navigation</Dialog.Title>
              <Sidebar
                items={items}
                collapsed={false}
                onNavigate={() => setDrawerOpen(false)}
                isAdmin={adminOnly}
              />
            </Dialog.Content>
          </Dialog.Portal>

          <div
            className={cn(
              "flex min-w-0 flex-1 flex-col transition-[padding] duration-200",
              collapsed ? "lg:pl-[4.5rem]" : "lg:pl-64"
            )}
          >
            <Topbar title={title} onOpenMenu={() => setDrawerOpen(true)} />
            <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
          </div>
        </Dialog.Root>
      </div>
    </RequireAuth>
  )
}
