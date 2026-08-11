"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, Eye, EyeOff, Lock, User } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input, PasswordToggle } from "@/components/ui/input"
import { FormAlert } from "@/components/auth/form-alert"
import { useAuth } from "@/components/providers/auth-provider"
import { useToast } from "@/components/ui/toast"
import { isApiError } from "@/lib/api/client"
import { validateLogin, type Errors, type LoginValues } from "@/lib/validation"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()
  const toast = useToast()

  const [values, setValues] = useState<LoginValues>({
    identifier: "",
    password: "",
  })
  const [errors, setErrors] = useState<Errors<LoginValues>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const update = (field: keyof LoginValues) => (value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }))
    // Clear the error as soon as the user starts correcting the field.
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
    if (formError) setFormError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const nextErrors = validateLogin(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    setFormError(null)

    try {
      const user = await login({
        identifier: values.identifier.trim(),
        password: values.password,
        remember,
      })

      toast.success(`Welcome back, ${user.fullName.split(" ")[0]}`)

      // `?next=` is set when a guest is bounced off a protected page. Honour it
      // for either role — an admin sent here from `/admin/users` should land
      // back on `/admin/users`, not the overview.
      const next = safeNext(searchParams.get("next"))
      const home = user.role === "ADMIN" ? "/admin" : "/dashboard"

      router.replace(next ?? home)
    } catch (error) {
      if (isApiError(error)) {
        // The server returns one indistinguishable error for an unknown account
        // and a wrong password, so there is nothing to attribute to a field.
        setFormError(error.message)
      } else {
        setFormError("Something went wrong. Please try again.")
      }
      setSubmitting(false)
    }
    // On success we deliberately stay in the submitting state — the route is
    // already changing, and re-enabling the button invites a second submit.
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {formError && <FormAlert>{formError}</FormAlert>}

      <div className="space-y-5">
        <Input
          id="identifier"
          label="Email or username"
          icon={User}
          type="text"
          autoComplete="username"
          placeholder="you@example.com"
          value={values.identifier}
          onChange={(e) => update("identifier")(e.target.value)}
          error={errors.identifier}
          valid={!errors.identifier && values.identifier.trim().length > 2}
        />

        <div>
          <Input
            id="password"
            label="Password"
            icon={Lock}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            value={values.password}
            onChange={(e) => update("password")(e.target.value)}
            error={errors.password}
            trailing={
              <PasswordToggle
                shown={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
                Icon={showPassword ? EyeOff : Eye}
              />
            }
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Checkbox
            id="remember"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          >
            Keep me signed in
          </Checkbox>

          <Link
            href="/forgot-password"
            className="text-sm font-semibold text-primary-600 underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

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
              Signing in…
            </>
          ) : (
            <>
              Sign In
              <ArrowRight className="transition-transform group-hover/button:translate-x-0.5" />
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

/**
 * Accept only same-origin, absolute-path destinations.
 *
 * `?next=` is attacker-controllable — it is just a query parameter on a public
 * page — and it is handed straight to the router. Without this check, a link
 * like `/login?next=https://evil.example` would carry someone off-site at the
 * exact moment they have just signed in and are most likely to trust the page
 * they land on.
 *
 * A leading single slash is the whole test: it rejects absolute URLs with a
 * scheme, protocol-relative `//host`, and the `/\host` form that some browsers
 * normalise into one.
 */
function safeNext(value: string | null): string | null {
  if (!value) return null
  if (!value.startsWith("/")) return null
  if (value.startsWith("//") || value.startsWith("/\\")) return null
  return value
}
