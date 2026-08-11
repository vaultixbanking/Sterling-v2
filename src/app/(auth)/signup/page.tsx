import type { Metadata } from "next"
import Link from "next/link"

import { AuthShell } from "@/components/auth/auth-shell"
import { SignupForm } from "@/components/auth/signup-form"

export const metadata: Metadata = {
  title: "Open an Account",
  description:
    "Open a Sterling Edge Trade account in minutes and trade over 1,000 instruments across forex, crypto, stocks and commodities from $250.",
}

export default function SignupPage() {
  return (
    <AuthShell
      title="Open your account"
      subtitle="Trade forex, crypto, stocks and commodities from one balance. It takes about two minutes."
      panelTitle="One account. Every market that matters."
      panelPoints={[
        "Over 1,000 instruments across four asset classes",
        "Spreads from 0.1 pips and zero commission on stocks",
        "Start from $250 with no deposit fees",
        "Professional charting and risk tools included free",
      ]}
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-primary-600 underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  )
}
