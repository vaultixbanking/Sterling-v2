"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ShieldCheck } from "lucide-react"

import { Logo } from "@/components/logo"
import { isActivePath, type NavItem } from "@/lib/app-nav"
import { cn } from "@/lib/utils"

/**
 * The signed-in navigation.
 *
 * One component serves three presentations — expanded desktop rail, collapsed
 * icon rail, and the mobile drawer's contents — because they differ only in
 * width and whether labels are visible. Keeping them as one avoids the drift
 * where a link gets added to the desktop nav and forgotten on mobile.
 *
 * The collapse toggle deliberately lives in the topbar, not here. When it sat
 * inside the sidebar it had to move — header when expanded, footer when
 * collapsed — so collapsing the rail appeared to delete the control that undid
 * it. A fixed position in the topbar is the same target in both states.
 */
export function Sidebar({
  items,
  collapsed,
  onNavigate,
  isAdmin = false,
}: {
  items: NavItem[]
  collapsed: boolean
  /** Lets the drawer close itself when a link is followed. */
  onNavigate?: () => void
  isAdmin?: boolean
}) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col border-r border-secondary-200/70 bg-secondary-50/60">
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-secondary-200/70",
          collapsed ? "justify-center px-2" : "px-5"
        )}
      >
        <Link
          href={isAdmin ? "/admin" : "/dashboard"}
          onClick={onNavigate}
          className="rounded-lg outline-none focus-visible:ring-4 focus-visible:ring-primary-200"
          aria-label="Sterling Edge Trade home"
        >
          <Logo showWordmark={!collapsed} />
        </Link>
      </div>

      {isAdmin && (
        <div
          className={cn(
            "mx-3 mt-3 flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-white",
            collapsed && "mx-2 justify-center px-2"
          )}
        >
          <ShieldCheck className="size-4 shrink-0" />
          {!collapsed && (
            <span className="text-xs font-semibold tracking-wide uppercase">
              Admin panel
            </span>
          )}
        </div>
      )}

      <nav
        className="flex-1 space-y-1 overflow-y-auto p-3"
        aria-label={isAdmin ? "Admin" : "Main"}
      >
        {items.map((item) => {
          const active = isActivePath(pathname, item)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-4 focus-visible:ring-primary-200",
                collapsed && "justify-center px-2",
                active
                  ? "bg-primary-600 text-white shadow-sm shadow-primary-600/20"
                  : "text-secondary-600 hover:bg-secondary-200/60 hover:text-secondary-900"
              )}
            >
              <Icon className="size-4.5 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
