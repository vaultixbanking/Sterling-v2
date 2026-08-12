import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"

import { pageSeo } from "@/lib/seo"
import { AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = pageSeo({
  title: "Sign In",
  description:
    "Sign in to your Sterling Edge Trade account to manage your portfolio across forex, crypto, stocks and commodities.",
  path: "/login",
})

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up where you left off and check on your open positions."
      panelTitle="Your markets are open. Let's get back to work."
      panelPoints={[
        "Live positions and P&L the moment you sign in",
        "Deposits and withdrawals from one balance",
        "Segregated client funds and negative-balance protection",
        "Support that answers 24 hours a day, 7 days a week",
      ]}
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-semibold text-primary-600 underline-offset-4 hover:underline"
          >
            Open one in minutes
          </Link>
        </>
      }
    >
      {/* The form reads `?next=` to return you to the page you were bounced
          off, which is only readable once the client takes over. */}
      <Suspense fallback={<FormSkeleton />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  )
}

function FormSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-[74px] w-full rounded-xl" />
      <Skeleton className="h-[74px] w-full rounded-xl" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-12 w-full rounded-lg" />
    </div>
  )
}
