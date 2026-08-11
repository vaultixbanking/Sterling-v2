"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRight, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { navLinks } from "@/lib/site"

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Lock body scroll while the mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  // Close the drawer on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  /** Transparent over the hero photo, solid once the user scrolls */
  const onDark = !scrolled && !open

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-300",
          onDark
            ? "border-b border-transparent bg-transparent py-3"
            : "border-b border-secondary-100 bg-white/90 py-2 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-white/80"
        )}
      >
        <div className="container-px flex h-14 items-center justify-between gap-4">
          <Link href="/" aria-label="Sterling Edge Trade home" className="shrink-0">
            <Logo invert={onDark} />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  onDark
                    ? "text-white/80 hover:bg-white/10 hover:text-white"
                    : "text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className={cn(
                "hidden h-10 items-center rounded-lg px-4 text-sm font-semibold transition-colors sm:inline-flex",
                onDark
                  ? "border border-white/25 text-white hover:bg-white/10"
                  : "border border-secondary-200 text-secondary-700 hover:bg-secondary-50"
              )}
            >
              Log In
            </Link>

            <Button asChild size="default" className="hidden sm:inline-flex">
              <Link href="/signup">
                Open Account
                <ArrowRight className="transition-transform group-hover/button:translate-x-0.5" />
              </Link>
            </Button>

            {/* Mobile hamburger */}
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={open}
              onClick={() => setOpen(true)}
              className={cn(
                "z-60 inline-flex size-10 flex-col items-center justify-center gap-1.5 rounded-lg transition-colors lg:hidden",
                onDark ? "text-white hover:bg-white/10" : "hover:bg-secondary-100"
              )}
            >
              <span
                className={cn(
                  "block h-0.5 w-6 rounded-full transition-colors",
                  onDark ? "bg-white" : "bg-secondary-700"
                )}
              />
              <span
                className={cn(
                  "block h-0.5 w-6 rounded-full transition-colors",
                  onDark ? "bg-white" : "bg-secondary-700"
                )}
              />
              <span
                className={cn(
                  "block h-0.5 w-6 rounded-full transition-colors",
                  onDark ? "bg-white" : "bg-secondary-700"
                )}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Scrim */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          open ? "visible opacity-100" : "invisible opacity-0"
        )}
      />

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 flex h-full w-[300px] max-w-[85vw] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out lg:hidden",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-secondary-100 px-5 py-4">
          <Logo />
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="inline-flex size-9 items-center justify-center rounded-lg text-secondary-600 transition-colors hover:bg-secondary-100"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-3 text-sm font-medium text-secondary-700 transition-colors hover:bg-primary-50 hover:text-primary-600"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="space-y-2 border-t border-secondary-100 p-5">
          <Button asChild variant="outline" className="w-full">
            <Link href="/login" onClick={() => setOpen(false)}>
              Log In
            </Link>
          </Button>
          <Button asChild className="w-full">
            <Link href="/signup" onClick={() => setOpen(false)}>
              Open Account
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </>
  )
}
