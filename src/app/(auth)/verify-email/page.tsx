import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"

import { AuthShell } from "@/components/auth/auth-shell"
import { VerifyEmailForm } from "@/components/auth/verify-email-form"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
  title: "Confirm Your Email",
  description: "Confirm your email address for your Sterling Edge Trade account.",
  // Reachable only via a one-time emailed token.
  robots: { index: false, follow: false },
}

export default function VerifyEmailPage() {
  return (
    <AuthShell
      title="Confirm your email"
      subtitle="One click and we can reach you about deposits, withdrawals and anything that needs your attention."
      panelTitle="A confirmed address is how we reach you when it matters."
      panelPoints={[
        "Deposit and withdrawal updates land the moment they happen",
        "Security alerts if anyone signs in from a new device",
        "Password resets only work with a reachable address",
        "This link works once and expires after 24 hours",
      ]}
      footer={
        <>
          Already confirmed?{" "}
          <Link
            href="/login"
            className="font-semibold text-primary-600 underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      {/* The form reads `?token=`, only available once the client takes over. */}
      <Suspense fallback={<FormSkeleton />}>
        <VerifyEmailForm />
      </Suspense>
    </AuthShell>
  )
}

function FormSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-[168px] w-full rounded-2xl" />
    </div>
  )
}
