"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, CheckCircle2, Eye, EyeOff, Lock, LinkIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input, PasswordToggle } from "@/components/ui/input"
import { FormAlert } from "@/components/auth/form-alert"
import { PasswordStrength } from "@/components/auth/password-strength"
import { useToast } from "@/components/ui/toast"
import { isApiError } from "@/lib/api/client"
import * as api from "@/lib/api/endpoints"
import { scorePassword } from "@/lib/validation"

/**
 * Consumes the link sent by `sendPasswordResetEmail`, which points at
 * `${APP_URL}/reset-password?token=…`. The token is single-use, expires after
 * 30 minutes, and a successful reset revokes every existing session — so this
 * always ends at the sign-in screen rather than logging the user straight in.
 */
export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()

  const token = searchParams.get("token") ?? ""

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [errors, setErrors] = useState<{
    password?: string
    confirmPassword?: string
  }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  // A link that arrived without a token can never work, so say so up front
  // rather than after a round trip.
  if (!token) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100">
          <LinkIcon className="size-6 text-amber-600" />
        </span>
        <h2 className="mt-4 text-base font-bold text-amber-900">
          This link is incomplete
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-amber-700">
          It looks like the reset link was cut short — some email clients wrap
          long links across lines. Request a fresh one and open it in a single
          click.
        </p>
        <Button asChild variant="outline" className="mt-5">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    )
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="size-6 text-emerald-600" />
        </span>
        <h2 className="mt-4 text-base font-bold text-emerald-900">
          Password updated
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-emerald-700">
          For your security, every device that was signed in has been signed
          out. Use your new password to sign back in.
        </p>
        <Button asChild variant="gradient" className="mt-5">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const nextErrors: typeof errors = {}
    if (!password) {
      nextErrors.password = "Create a password."
    } else if (scorePassword(password).score < 3) {
      nextErrors.password =
        "Use at least 8 characters with a capital and a number."
    }
    if (!confirmPassword) {
      nextErrors.confirmPassword = "Re-enter your password."
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = "Passwords do not match."
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    setFormError(null)

    try {
      await api.auth.resetPassword(token, password)
      toast.success("Password updated", "Sign in with your new password.")
      setDone(true)
      // Prefetch so the "Go to sign in" button feels instant.
      router.prefetch("/login")
    } catch (error) {
      if (isApiError(error)) {
        const fields = error.fieldErrors()
        if (fields.password) {
          setErrors({ password: fields.password })
        } else {
          setFormError(error.message)
        }
      } else {
        setFormError("Something went wrong. Please try again.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {formError && (
        <FormAlert>
          {formError}{" "}
          <Link
            href="/forgot-password"
            className="font-semibold underline underline-offset-2"
          >
            Request a new link
          </Link>
          .
        </FormAlert>
      )}

      <div className="space-y-5">
        <div>
          <Input
            id="password"
            label="New password"
            icon={Lock}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Create a strong password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (errors.password) {
                setErrors((prev) => ({ ...prev, password: undefined }))
              }
            }}
            error={errors.password}
            trailing={
              <PasswordToggle
                shown={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
                Icon={showPassword ? EyeOff : Eye}
              />
            }
          />
          <PasswordStrength password={password} />
        </div>

        <Input
          id="confirmPassword"
          label="Confirm new password"
          icon={Lock}
          type={showConfirm ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value)
            if (errors.confirmPassword) {
              setErrors((prev) => ({ ...prev, confirmPassword: undefined }))
            }
          }}
          error={errors.confirmPassword}
          valid={
            !errors.confirmPassword &&
            confirmPassword.length > 0 &&
            confirmPassword === password
          }
          trailing={
            <PasswordToggle
              shown={showConfirm}
              onToggle={() => setShowConfirm((v) => !v)}
              Icon={showConfirm ? EyeOff : Eye}
            />
          }
        />

        <Button
          type="submit"
          variant="gradient"
          size="lg"
          className="w-full"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <span className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Updating…
            </>
          ) : (
            <>
              Update Password
              <ArrowRight className="transition-transform group-hover/button:translate-x-0.5" />
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
