"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  AtSign,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  UserRound,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input, PasswordToggle } from "@/components/ui/input"
import { FormAlert } from "@/components/auth/form-alert"
import { PasswordStrength } from "@/components/auth/password-strength"
import { useAuth } from "@/components/providers/auth-provider"
import { useToast } from "@/components/ui/toast"
import { isApiError } from "@/lib/api/client"
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
  phone: "",
  password: "",
  confirmPassword: "",
  terms: false,
}

export function SignupForm() {
  const router = useRouter()
  const { register } = useAuth()
  const toast = useToast()

  const [values, setValues] = useState<SignupValues>(EMPTY)
  const [errors, setErrors] = useState<Errors<SignupValues>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const update =
    <K extends keyof SignupValues>(field: K) =>
    (value: SignupValues[K]) => {
      setValues((prev) => ({ ...prev, [field]: value }))
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
      if (formError) setFormError(null)
    }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nextErrors = validateSignup(values)
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
      const phone = values.phone.trim()

      await register({
        fullName: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
        username: values.username.trim(),
        // Omitted rather than sent empty — the API validates the shape of any
        // phone it is given.
        ...(phone ? { phone } : {}),
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
        for (const key of ["fullName", "email", "username", "phone", "password"] as const) {
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
          <Input
            id="username"
            label="Username"
            icon={AtSign}
            type="text"
            autoComplete="username"
            placeholder="Choose a username"
            value={values.username}
            onChange={(e) => update("username")(e.target.value)}
            error={errors.username}
            valid={!errors.username && USERNAME_RE.test(values.username.trim())}
          />

          <Input
            id="phone"
            label="Phone number"
            icon={Phone}
            type="tel"
            autoComplete="tel"
            optional
            placeholder="+1 (555) 123-4567"
            value={values.phone}
            onChange={(e) => update("phone")(e.target.value)}
            error={errors.phone}
          />
        </div>

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
