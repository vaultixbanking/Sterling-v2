"use client"

import { useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  AtSign,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  UserRound,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { CountrySelect } from "@/components/ui/country-select"
import { Input, PasswordToggle } from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { FormAlert } from "@/components/auth/form-alert"
import { PasswordStrength } from "@/components/auth/password-strength"
import { useAuth } from "@/components/providers/auth-provider"
import { useToast } from "@/components/ui/toast"
import { isApiError } from "@/lib/api/client"
import { guessCountry, toE164 } from "@/lib/countries"
import {
  useUsernameCheck,
  type UsernameState,
} from "@/lib/use-username-check"
import {
  EMAIL_RE,
  USERNAME_RE,
  validateSignup,
  type Errors,
  type SignupValues,
} from "@/lib/validation"

const EMPTY: SignupValues = {
  fullName: "",
  email: "",
  username: "",
  // Filled in from the browser locale on mount — a default the user can change,
  // never something inferred and hidden.
  country: "",
  phone: "",
  password: "",
  confirmPassword: "",
  terms: false,
}

/** The guess never changes within a session, so there is nothing to subscribe to. */
const subscribeNever = () => () => {}

export function SignupForm() {
  const router = useRouter()
  const { register } = useAuth()
  const toast = useToast()

  const [values, setValues] = useState<SignupValues>(EMPTY)

  /**
   * The default country, read from the browser.
   *
   * `guessCountry` reads `navigator`, which does not exist during the server
   * render — and this page is prerendered. `useSyncExternalStore` is the API
   * built for exactly that: it takes a separate server snapshot, so React
   * hydrates with "" and swaps in the real guess without a mismatch. An effect
   * plus `setState` would work too, at the cost of an extra render pass.
   *
   * It is only a default. The moment the user picks anything, `values.country`
   * wins.
   */
  const guessedCountry = useSyncExternalStore(
    subscribeNever,
    guessCountry,
    () => ""
  )
  const country = values.country || guessedCountry
  const [errors, setErrors] = useState<Errors<SignupValues>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Live availability. Advisory only — `register` re-checks and can still
  // return a 409, so this makes a collision rare rather than impossible.
  const usernameState = useUsernameCheck(values.username, values.fullName)

  // Surfaced through the Input's own error slot so the field turns red and is
  // announced, rather than sitting as a second, quieter opinion underneath it.
  const unavailableMessage =
    usernameState.status === "unavailable" ? usernameState.message : undefined

  const update =
    <K extends keyof SignupValues>(field: K) =>
    (value: SignupValues[K]) => {
      setValues((prev) => ({ ...prev, [field]: value }))
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
      if (formError) setFormError(null)
    }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nextErrors = validateSignup({ ...values, country })
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      // Move focus to the first problem so keyboard and screen-reader users
      // aren't left hunting for it.
      document.getElementById(Object.keys(nextErrors)[0])?.focus()
      return
    }

    setSubmitting(true)
    setFormError(null)

    try {
      // Sent in E.164 so the stored value is canonical. Validation has already
      // passed at this point, so the fallback is unreachable.
      const phone = toE164(values.phone, country) ?? values.phone.trim()

      await register({
        fullName: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
        username: values.username.trim(),
        country,
        phone,
        password: values.password,
        acceptedTerms: true,
      })

      toast.success("Account created", "Welcome to Sterling Edge Trade.")
      router.replace("/welcome")
    } catch (error) {
      if (isApiError(error)) {
        // A taken email or username comes back attributed to its field.
        const fields = error.fieldErrors()
        const mapped: Errors<SignupValues> = {}
        for (const key of [
          "fullName",
          "email",
          "username",
          "country",
          "phone",
          "password",
        ] as const) {
          if (fields[key]) mapped[key] = fields[key]
        }

        if (Object.keys(mapped).length > 0) {
          setErrors(mapped)
          document.getElementById(Object.keys(mapped)[0]!)?.focus()
        } else if (error.code === "CONFLICT") {
          // The server does not say which field collided, so read the message.
          const field = /username/i.test(error.message) ? "username" : "email"
          setErrors({ [field]: error.message })
          document.getElementById(field)?.focus()
        } else {
          setFormError(error.message)
        }
      } else {
        setFormError("Something went wrong. Please try again.")
      }
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {formError && <FormAlert>{formError}</FormAlert>}

      <div className="space-y-5">
        <Input
          id="fullName"
          label="Full name"
          icon={UserRound}
          type="text"
          autoComplete="name"
          placeholder="Enter your full name"
          value={values.fullName}
          onChange={(e) => update("fullName")(e.target.value)}
          error={errors.fullName}
          valid={!errors.fullName && values.fullName.trim().length >= 3}
        />

        <Input
          id="email"
          label="Email address"
          icon={Mail}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={values.email}
          onChange={(e) => update("email")(e.target.value)}
          error={errors.email}
          valid={!errors.email && EMAIL_RE.test(values.email.trim())}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Input
              id="username"
              label="Username"
              icon={AtSign}
              type="text"
              autoComplete="username"
              placeholder="Choose a username"
              value={values.username}
              onChange={(e) => update("username")(e.target.value)}
              error={errors.username ?? unavailableMessage}
              valid={
                !errors.username &&
                USERNAME_RE.test(values.username.trim()) &&
                usernameState.status === "available"
              }
            />
            <UsernameStatus
              state={usernameState}
              hasFieldError={Boolean(errors.username)}
              onPick={(name) => update("username")(name)}
            />
          </div>

          <div>
            <label
              htmlFor="country"
              className="mb-2 block text-sm font-medium text-secondary-700"
            >
              Country of residence
            </label>
            <CountrySelect
              id="country"
              value={country}
              onChange={(code) => update("country")(code)}
              invalid={Boolean(errors.country)}
              disabled={submitting}
            />
            {errors.country && (
              <p className="mt-2 text-xs text-red-600">{errors.country}</p>
            )}
          </div>
        </div>

        <PhoneInput
          id="phone"
          label="Phone number"
          country={country}
          onCountryChange={(code) => update("country")(code)}
          value={values.phone}
          onChange={(next) => update("phone")(next)}
          error={errors.phone}
          valid={Boolean(toE164(values.phone, country))}
          hint="We use this to reach you about your account and withdrawals."
          disabled={submitting}
        />

        <div>
          <Input
            id="password"
            label="Password"
            icon={Lock}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Create a strong password"
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
          <PasswordStrength password={values.password} />
        </div>

        <Input
          id="confirmPassword"
          label="Confirm password"
          icon={Lock}
          type={showConfirm ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={values.confirmPassword}
          onChange={(e) => update("confirmPassword")(e.target.value)}
          error={errors.confirmPassword}
          valid={
            !errors.confirmPassword &&
            values.confirmPassword.length > 0 &&
            values.confirmPassword === values.password
          }
          trailing={
            <PasswordToggle
              shown={showConfirm}
              onToggle={() => setShowConfirm((v) => !v)}
              Icon={showConfirm ? EyeOff : Eye}
            />
          }
        />

        <Checkbox
          id="terms"
          checked={values.terms}
          onChange={(e) => update("terms")(e.target.checked)}
          error={errors.terms}
        >
          I agree to the{" "}
          <Link
            href="/#faq"
            className="font-semibold text-primary-600 underline-offset-4 hover:underline"
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/#faq"
            className="font-semibold text-primary-600 underline-offset-4 hover:underline"
          >
            Risk Disclosure
          </Link>
          , and confirm I am at least 18 years old.
        </Checkbox>

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
              Creating account…
            </>
          ) : (
            <>
              Create Account
              <ArrowRight className="transition-transform group-hover/button:translate-x-0.5" />
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

/**
 * The line under the username field: checking, free, or taken with a way out.
 *
 * Suggestions are buttons rather than text because the point is to end the
 * problem in one click — reading `joshua_okoghie` and retyping it by hand is
 * most of the friction the live check was meant to remove.
 */
function UsernameStatus({
  state,
  hasFieldError,
  onPick,
}: {
  state: UsernameState
  /** The form's own validation wins — never argue with it in two voices. */
  hasFieldError: boolean
  onPick: (username: string) => void
}) {
  if (hasFieldError || state.status === "idle") return null

  if (state.status === "checking") {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-xs text-secondary-500">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        Checking availability…
      </p>
    )
  }

  if (state.status === "available") {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
        <Check className="size-3.5" aria-hidden />
        That username is available.
      </p>
    )
  }

  if (state.suggestions.length === 0) return null

  return (
    <div className="mt-2">
      <p className="text-xs text-secondary-500">Try one of these instead:</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {state.suggestions.map((suggestion) => (
          <li key={suggestion}>
            <button
              type="button"
              onClick={() => onPick(suggestion)}
              className="rounded-lg border border-secondary-200 bg-white px-2.5 py-1 text-xs font-semibold text-secondary-700 transition-colors hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700"
            >
              {suggestion}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
