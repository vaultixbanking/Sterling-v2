import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"

import { AuthShell } from "@/components/auth/auth-shell"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
  title: "Set a New Password",
  description: "Choose a new password for your Sterling Edge Trade account.",
  // A page reachable only via a one-time emailed token has no business in an
  // index.
  robots: { index: false, follow: false },
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose something you haven't used elsewhere. You'll sign in with it straight after."
      panelTitle="One strong password, and you're back to trading."
      panelPoints={[
        "This link works once and expires after 30 minutes",
        "Every signed-in device is signed out when you finish",
        "We store passwords hashed — never in plain text",
        "Your positions and balance are untouched by a reset",
      ]}
      footer={
        <>
          Remembered it after all?{" "}
          <Link
            href="/login"
            className="font-semibold text-primary-600 underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      {/* The form reads `?token=`, which is only available once the client
          takes over. */}
      <Suspense fallback={<FormSkeleton />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  )
}

function FormSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-[74px] w-full rounded-xl" />
      <Skeleton className="h-[74px] w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-lg" />
    </div>
  )
}
