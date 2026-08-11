"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  ArrowRight,
  Check,
  Headphones,
  LayoutDashboard,
  ShieldCheck,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/ui/copy-button"
import { Logo } from "@/components/logo"
import { useAuth } from "@/components/providers/auth-provider"
import * as api from "@/lib/api/endpoints"
import { formatMoney, isZero } from "@/lib/format"
import { hasOnboarded, markOnboarded } from "@/lib/onboarding"
import { company } from "@/lib/site"
import { cn } from "@/lib/utils"

/**
 * Shown once, straight after signing up.
 *
 * SwiftEdge's welcome page was a five-second interstitial: a progress bar that
 * counted up on `Math.random() * 15` while loading nothing, fifty animated
 * particle divs, and a button. It was also dark, wedged between a light login
 * and a light dashboard.
 *
 * This does something instead. Each step reads live account state, so the ticks
 * are real and the page is worth landing on rather than clicking through.
 */

interface Step {
  key: string
  title: string
  description: string
  href: string
  cta: string
  icon: LucideIcon
  done: boolean
}

export function WelcomeScreen() {
  const { user } = useAuth()
  const router = useRouter()

  const [funded, setFunded] = useState<boolean | null>(null)
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const [balance, setBalance] = useState<string | null>(null)

  // Onboarding is a one-time moment. Anyone who has already been through it and
  // lands here again — a stale tab, the back button, a bookmarked URL — goes
  // straight to the dashboard rather than being asked to start over.
  useEffect(() => {
    if (user && hasOnboarded(user.id)) {
      router.replace("/dashboard")
    }
  }, [user, router])

  useEffect(() => {
    let cancelled = false

    // Each check stands alone: a failing plans call must not blank the balance.
    void api.portfolio
      .summary()
      .then((summary) => {
        if (cancelled) return
        setBalance(summary.balance)
        setFunded(!isZero(summary.balance))
      })
      .catch(() => {
        if (!cancelled) setFunded(false)
      })

    void api.subscriptions
      .list()
      .then(({ subscriptions }) => {
        if (!cancelled) setSubscribed(subscriptions.length > 0)
      })
      .catch(() => {
        if (!cancelled) setSubscribed(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const firstName = user?.fullName.trim().split(/\s+/)[0] ?? "there"

  const steps: Step[] = [
    {
      key: "fund",
      title: "Fund your account",
      description:
        "Add funds by bank transfer, crypto or digital wallet. Your deposit is credited once our team confirms it.",
      href: "/deposit",
      cta: "Make a deposit",
      icon: Wallet,
      done: funded === true,
    },
    {
      key: "plan",
      title: "Choose an investment plan",
      description:
        "Four plans, from Starter at $250 to Platinum. Each states its daily return and term up front.",
      href: "/plans",
      cta: "Compare plans",
      icon: TrendingUp,
      done: subscribed === true,
    },
    {
      key: "secure",
      title: "Secure your account",
      description:
        "Add a phone number so we can reach you about withdrawals, and check your password is one you use nowhere else.",
      href: "/settings",
      cta: "Open settings",
      icon: ShieldCheck,
      done: Boolean(user?.phone),
    },
  ]

  const completed = steps.filter((step) => step.done).length

  const finish = (destination: string) => {
    if (user) markOnboarded(user.id)
    router.push(destination)
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      {/* Soft brand wash behind the header, matching the marketing hero. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-glow" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-dotted opacity-[0.35]"
      />

      <div className="relative container-px py-8">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" aria-label={`${company.name} home`}>
            <Logo />
          </Link>
          <button
            type="button"
            onClick={() => finish("/dashboard")}
            className="text-sm font-medium text-secondary-500 underline-offset-4 transition-colors hover:text-primary-600 hover:underline"
          >
            Skip for now
          </button>
        </header>

        <main className="mx-auto max-w-3xl pt-12 pb-20 sm:pt-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <span className="eyebrow">Account opened</span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance text-secondary-900 sm:text-4xl">
              Welcome to Sterling Edge, {firstName}.
            </h1>
            <p className="section-subtitle mt-3 max-w-xl">
              Your account is live. Three short steps and you&apos;ll be ready to
              take your first position.
            </p>
          </motion.div>

          {/* Account summary */}
          <motion.dl
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: "easeOut" }}
            className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-secondary-200 bg-secondary-200 sm:grid-cols-3"
          >
            <div className="bg-white px-5 py-4">
              <dt className="text-xs font-medium tracking-wide text-secondary-500 uppercase">
                Account ID
              </dt>
              <dd className="mt-1.5 flex items-center gap-1">
                <span className="font-mono text-sm font-semibold text-secondary-900">
                  {user?.uid ?? "—"}
                </span>
                {user?.uid && (
                  <CopyButton value={user.uid} label="Copy your account ID" />
                )}
              </dd>
            </div>

            <div className="bg-white px-5 py-4">
              <dt className="text-xs font-medium tracking-wide text-secondary-500 uppercase">
                Balance
              </dt>
              <dd className="tabular mt-1.5 text-sm font-semibold text-secondary-900">
                {balance === null ? (
                  <span className="inline-block h-4 w-20 animate-pulse rounded bg-secondary-100 align-middle" />
                ) : (
                  formatMoney(balance)
                )}
              </dd>
            </div>

            <div className="bg-white px-5 py-4">
              <dt className="text-xs font-medium tracking-wide text-secondary-500 uppercase">
                Setup
              </dt>
              <dd className="mt-1.5 text-sm font-semibold text-secondary-900">
                {completed} of {steps.length} complete
              </dd>
            </div>
          </motion.dl>

          {/* Checklist */}
          <ol className="mt-8 space-y-3">
            {steps.map((step, index) => (
              <motion.li
                key={step.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.4,
                  delay: 0.16 + index * 0.07,
                  ease: "easeOut",
                }}
              >
                <StepRow step={step} index={index} />
              </motion.li>
            ))}
          </ol>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <Button
              size="lg"
              variant="gradient"
              onClick={() => finish("/dashboard")}
            >
              <LayoutDashboard />
              Go to dashboard
              <ArrowRight className="transition-transform group-hover/button:translate-x-0.5" />
            </Button>

            <p className="flex items-center gap-2 text-sm text-secondary-500">
              <Headphones className="size-4 shrink-0 text-primary-600" />
              Stuck? Email{" "}
              <a
                href={`mailto:${company.email}`}
                className="font-semibold text-primary-600 underline-offset-4 hover:underline"
              >
                {company.email}
              </a>
            </p>
          </motion.div>
        </main>
      </div>
    </div>
  )
}

function StepRow({ step, index }: { step: Step; index: number }) {
  const Icon = step.icon

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border p-5 transition-colors sm:flex-row sm:items-center",
        step.done
          ? "border-emerald-200 bg-emerald-50/60"
          : "border-secondary-200 bg-white hover:border-primary-300"
      )}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl",
          step.done ? "bg-emerald-100" : "bg-primary-50"
        )}
      >
        {step.done ? (
          <Check className="size-5 text-emerald-600" strokeWidth={3} />
        ) : (
          <Icon className="size-5 text-primary-600" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <h2
          className={cn(
            "flex items-center gap-2 text-sm font-bold",
            step.done ? "text-emerald-900" : "text-secondary-900"
          )}
        >
          <span className="text-xs font-semibold text-secondary-400 tabular">
            {String(index + 1).padStart(2, "0")}
          </span>
          {step.title}
          {step.done && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              Done
            </span>
          )}
        </h2>
        <p
          className={cn(
            "mt-1 text-sm leading-relaxed",
            step.done ? "text-emerald-700" : "text-secondary-600"
          )}
        >
          {step.description}
        </p>
      </div>

      {/* A completed step still links out — "review" rather than a dead end. */}
      <Button
        asChild
        variant={step.done ? "ghost" : "outline"}
        size="sm"
        className="shrink-0"
      >
        <Link href={step.href}>
          {step.done ? "Review" : step.cta}
          <ArrowRight />
        </Link>
      </Button>
    </div>
  )
}
