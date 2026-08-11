/**
 * Client-side form validation for the auth screens.
 * Deliberately dependency-free — the rules here will need to be mirrored
 * server-side once the backend exists; never treat these as authoritative.
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/i
export const PHONE_RE = /^[+]?[\d\s()-]{7,20}$/

export interface PasswordScore {
  /** 0–4 */
  score: number
  label: string
  /** Tailwind classes for the meter fill */
  barClass: string
  textClass: string
  checks: { label: string; met: boolean }[]
}

export function scorePassword(password: string): PasswordScore {
  const checks = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { label: "One number", met: /\d/.test(password) },
    { label: "One symbol", met: /[^A-Za-z0-9]/.test(password) },
  ]

  const score = checks.filter((c) => c.met).length

  const presets = [
    { label: "Too weak", barClass: "bg-red-500", textClass: "text-red-600" },
    { label: "Too weak", barClass: "bg-red-500", textClass: "text-red-600" },
    { label: "Weak", barClass: "bg-amber-500", textClass: "text-amber-600" },
    { label: "Good", barClass: "bg-blue-500", textClass: "text-blue-600" },
    {
      label: "Strong",
      barClass: "bg-emerald-500",
      textClass: "text-emerald-600",
    },
  ]

  return { score, checks, ...presets[score] }
}

export type Errors<T> = Partial<Record<keyof T, string>>

export interface LoginValues {
  identifier: string
  password: string
}

export function validateLogin(values: LoginValues): Errors<LoginValues> {
  const errors: Errors<LoginValues> = {}

  if (!values.identifier.trim()) {
    errors.identifier = "Enter your email address or username."
  }

  if (!values.password) {
    errors.password = "Enter your password."
  }

  return errors
}

export interface SignupValues {
  fullName: string
  email: string
  username: string
  phone: string
  password: string
  confirmPassword: string
  terms: boolean
}

export function validateSignup(values: SignupValues): Errors<SignupValues> {
  const errors: Errors<SignupValues> = {}

  if (!values.fullName.trim()) {
    errors.fullName = "Enter your full name."
  } else if (values.fullName.trim().length < 3) {
    errors.fullName = "That name looks too short."
  }

  if (!values.email.trim()) {
    errors.email = "Enter your email address."
  } else if (!EMAIL_RE.test(values.email.trim())) {
    errors.email = "Enter a valid email address."
  }

  if (!values.username.trim()) {
    errors.username = "Choose a username."
  } else if (!USERNAME_RE.test(values.username.trim())) {
    errors.username =
      "Use 3–20 characters: letters, numbers or underscores only."
  }

  if (values.phone.trim() && !PHONE_RE.test(values.phone.trim())) {
    errors.phone = "Enter a valid phone number."
  }

  if (!values.password) {
    errors.password = "Create a password."
  } else if (scorePassword(values.password).score < 3) {
    errors.password = "Use at least 8 characters with a capital and a number."
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = "Re-enter your password."
  } else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = "Passwords do not match."
  }

  if (!values.terms) {
    errors.terms = "You must accept the terms to open an account."
  }

  return errors
}
