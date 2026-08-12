"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { DropdownMenu } from "radix-ui"
import {
  ChevronDown,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  User,
} from "lucide-react"

import { useAuth } from "@/components/providers/auth-provider"
import { useToast } from "@/components/ui/toast"
import { initials } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Page heading, plus the account menu.
 *
 * There is deliberately no notifications bell. The API has no notifications
 * resource, and a bell that never rings is the same dead UI as SwiftEdge's nine
 * trade cards with no handlers — it can arrive when there is something to show.
 */
export function Topbar({
  title,
  onOpenMenu,
  collapsed,
  onToggleSidebar,
}: {
  title: string
  onOpenMenu: () => void
  collapsed: boolean
  onToggleSidebar: () => void
}) {
  const { user, logout } = useAuth()
  const router = useRouter()
  const toast = useToast()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await logout()
      router.replace("/login")
    } catch {
      // `logout` clears the local session even when the revoke call fails, so
      // the user is signed out here regardless; only the server-side revoke is
      // in doubt and that is worth saying out loud.
      toast.error("Signed out on this device, but the server did not confirm.")
      router.replace("/login")
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-secondary-200/70 bg-white/85 px-4 backdrop-blur-md sm:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open navigation"
        className="-ml-1 rounded-lg p-2 text-secondary-600 transition-colors hover:bg-secondary-100 hover:text-secondary-900 focus-visible:ring-4 focus-visible:ring-primary-200 focus-visible:outline-none lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      {/*
        Desktop counterpart to the hamburger, in the same slot. Both the label
        and the icon flip with the state so the control reads correctly whether
        the rail is open or shut.
      */}
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="-ml-1 hidden rounded-lg p-2 text-secondary-600 transition-colors hover:bg-secondary-100 hover:text-secondary-900 focus-visible:ring-4 focus-visible:ring-primary-200 focus-visible:outline-none lg:block"
      >
        {collapsed ? (
          <PanelLeftOpen className="size-5" />
        ) : (
          <PanelLeftClose className="size-5" />
        )}
      </button>

      <h1 className="truncate font-heading text-base font-bold text-secondary-900 sm:text-lg">
        {title}
      </h1>

      <div className="ml-auto flex items-center gap-3">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            className={cn(
              "flex items-center gap-2 rounded-full py-1 pr-2 pl-1 transition-colors outline-none",
              "hover:bg-secondary-100 focus-visible:ring-4 focus-visible:ring-primary-200"
            )}
            aria-label="Account menu"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-600 text-xs font-bold text-white">
              {initials(user?.fullName)}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block max-w-[10rem] truncate text-sm font-semibold text-secondary-900">
                {user?.fullName ?? "—"}
              </span>
              <span className="block text-[11px] text-secondary-500 tabular">
                {user?.uid ?? ""}
              </span>
            </span>
            <ChevronDown className="hidden size-4 text-secondary-400 sm:block" />
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-50 w-60 rounded-xl border border-secondary-200/70 bg-white p-1.5 shadow-xl"
            >
              <div className="border-b border-secondary-100 px-3 py-2.5">
                <p className="truncate text-sm font-semibold text-secondary-900">
                  {user?.fullName ?? "—"}
                </p>
                <p className="truncate text-xs text-secondary-500">
                  {user?.email ?? ""}
                </p>
              </div>

              <DropdownMenu.Item asChild>
                <Link
                  href="/settings"
                  className="mt-1 flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-secondary-700 outline-none select-none data-[highlighted]:bg-secondary-100 data-[highlighted]:text-secondary-900"
                >
                  <User className="size-4" />
                  Profile
                </Link>
              </DropdownMenu.Item>

              <DropdownMenu.Item asChild>
                <Link
                  href="/settings"
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-secondary-700 outline-none select-none data-[highlighted]:bg-secondary-100 data-[highlighted]:text-secondary-900"
                >
                  <Settings className="size-4" />
                  Settings
                </Link>
              </DropdownMenu.Item>

              <DropdownMenu.Separator className="my-1 h-px bg-secondary-100" />

              <DropdownMenu.Item
                disabled={signingOut}
                onSelect={(event) => {
                  // Keep the menu mounted while the request is in flight so the
                  // disabled state is visible rather than flashing shut.
                  event.preventDefault()
                  void handleSignOut()
                }}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-red-50"
              >
                <LogOut className="size-4" />
                {signingOut ? "Signing out…" : "Sign out"}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  )
}
