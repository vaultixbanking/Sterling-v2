"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AlertCircle, ArrowRight, CheckCircle2, LinkIcon, Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import { isApiError } from "@/lib/api/client"
import * as api from "@/lib/api/endpoints"

type State = "verifying" | "verified" | "failed"

/**
 * Consumes the link from `sendEmailVerificationEmail`, which points at
 * `${APP_URL}/verify-email?token=…`.
 *
 * Confirming is not a precondition of signing in — every account migrated from
 * the old platform predates verification — so a failure here offers a resend
 * and a way back to the app rather than trapping the user.
 */
export function VerifyEmailForm() {
  const searchParams = useSearchParams()
  const toast = useToast()

  const token = searchParams.get("token") ?? ""

  const [state, setState] = useState<State>("verifying")
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  // React runs effects twice in dev StrictMode. The token is single-use, so a
  // second call would consume it and report failure on an otherwise good link.
  const attempted = useRef(false)

  useEffect(() => {
    if (!token || attempted.current) return
    attempted.current = true

    let active = true

    api.auth
      .verifyEmail(token)
      .then(() => {
        if (!active) return
        setState("verified")
        toast.success("Email confirmed", "Your address is verified.")
      })
      .catch((cause: unknown) => {
        if (!active) return
        setState("failed")
        setError(
          isApiError(cause)
            ? cause.message
            : "We couldn't confirm your email. Please try again."
        )
      })

    return () => {
      active = false
    }
  }, [token, toast])

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      setEmailError("Enter the address you signed up with.")
      return
    }

    setResending(true)
    setEmailError(null)

    try {
      await api.auth.resendVerification(email.trim())
      setResent(true)
      toast.success("Link sent", "Check your inbox for a new confirmation link.")
    } catch {
      setEmailError("Something went wrong. Please try again.")
    } finally {
      setResending(false)
    }
  }

  if (!token) {
    return (
      <Notice
        tone="amber"
        icon={LinkIcon}
        title="This link is incomplete"
        body="Some email clients wrap long links across lines. Request a fresh one below and open it in a single click."
      >
        <ResendForm
          email={email}
          setEmail={setEmail}
          error={emailError}
          submitting={resending}
          sent={resent}
          onSubmit={handleResend}
        />
      </Notice>
    )
  }

  if (state === "verifying") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-slate-200">
          <span className="size-6 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
        </span>
        <h2 className="mt-4 text-base font-bold text-slate-900">
          Confirming your email…
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          This only takes a moment.
        </p>
      </div>
    )
  }

  if (state === "verified") {
    return (
      <Notice
        tone="emerald"
        icon={CheckCircle2}
        title="Email confirmed"
        body="Your address is verified, so deposit, withdrawal and security notices will reach you."
      >
        <Button asChild variant="gradient" className="mt-5">
          <Link href="/login">
            Go to sign in
            <ArrowRight className="transition-transform group-hover/button:translate-x-0.5" />
          </Link>
        </Button>
      </Notice>
    )
  }

  return (
    <Notice
      tone="amber"
      icon={AlertCircle}
      title="We couldn't confirm this link"
      body={error ?? "The link may have expired or already been used."}
    >
      <ResendForm
        email={email}
        setEmail={setEmail}
        error={emailError}
        submitting={resending}
        sent={resent}
        onSubmit={handleResend}
      />
      <p className="mt-4 text-sm text-slate-600">
        Confirming isn&apos;t required to use your account —{" "}
        <Link
          href="/login"
          className="font-semibold text-primary-600 underline-offset-4 hover:underline"
        >
          sign in as normal
        </Link>
        .
      </p>
    </Notice>
  )
}

function ResendForm({
  email,
  setEmail,
  error,
  submitting,
  sent,
  onSubmit,
}: {
  email: string
  setEmail: (value: string) => void
  error: string | null
  submitting: boolean
  sent: boolean
  onSubmit: (e: React.FormEvent) => void
}) {
  if (sent) {
    return (
      <div
        role="status"
        className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-100/60 p-4 text-left"
      >
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
        <p className="text-sm leading-relaxed text-emerald-800">
          If that address needs confirming, a new link is on its way.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-5 space-y-4 text-left">
      <Input
        id="email"
        label="Email address"
        icon={Mail}
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error ?? undefined}
      />
      <Button
        type="submit"
        variant="outline"
        className="w-full"
        disabled={submitting}
      >
        {submitting ? "Sending…" : "Send a new link"}
      </Button>
    </form>
  )
}

function Notice({
  tone,
  icon: Icon,
  title,
  body,
  children,
}: {
  tone: "amber" | "emerald"
  icon: typeof CheckCircle2
  title: string
  body: string
  children?: React.ReactNode
}) {
  const palette =
    tone === "emerald"
      ? {
          border: "border-emerald-200",
          bg: "bg-emerald-50",
          badge: "bg-emerald-100",
          icon: "text-emerald-600",
          title: "text-emerald-900",
          body: "text-emerald-700",
        }
      : {
          border: "border-amber-200",
          bg: "bg-amber-50",
          badge: "bg-amber-100",
          icon: "text-amber-600",
          title: "text-amber-900",
          body: "text-amber-700",
        }

  return (
    <div className={`rounded-2xl border ${palette.border} ${palette.bg} p-6 text-center`}>
      <span
        className={`mx-auto flex size-12 items-center justify-center rounded-full ${palette.badge}`}
      >
        <Icon className={`size-6 ${palette.icon}`} />
      </span>
      <h2 className={`mt-4 text-base font-bold ${palette.title}`}>{title}</h2>
      <p className={`mt-2 text-sm leading-relaxed ${palette.body}`}>{body}</p>
      {children}
    </div>
  )
}
