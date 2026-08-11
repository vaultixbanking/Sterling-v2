import type { Metadata } from "next"
import Link from "next/link"

import { AuthShell } from "@/components/auth/auth-shell"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

export const metadata: Metadata = {
  title: "Reset Password",
  description:
    "Reset the password on your Sterling Edge Trade account. We'll email you a secure link.",
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email address on your account and we'll send you a link to set a new password."
      panelTitle="Locked out? It happens. You'll be back in shortly."
      panelPoints={[
        "Reset links expire after 30 minutes for your safety",
        "We never email you your existing password",
        "Your positions and balance stay untouched",
        "Still stuck? Support answers around the clock",
      ]}
      footer={
        <>
          Remembered it?{" "}
          <Link
            href="/login"
            className="font-semibold text-primary-600 underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  )
}
