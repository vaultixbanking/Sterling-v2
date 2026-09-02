import { z } from "zod"

import { isSupportedCountry, toE164 } from "../../lib/phone.js"

/**
 * Boundary validation for the auth routes. These rules intentionally mirror
 * `src/lib/validation.ts` in the Next.js app so the client and server agree —
 * but the server is the only authority. Client validation is UX, never a
 * security boundary.
 */

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be at most 128 characters.")
  .regex(/[A-Z]/, "Password must contain an uppercase letter.")
  .regex(/[0-9]/, "Password must contain a number.")

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters.")
  .max(20, "Username must be at most 20 characters.")
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Username may contain letters, numbers and underscores only."
  )

/**
 * Live availability check.
 *
 * `username` is deliberately a loose string rather than `usernameSchema`: the
 * endpoint's job is to explain *why* a name will not work, and rejecting it at
 * the boundary would return a generic 400 instead of the specific reason the
 * form wants to render.
 *
 * A POST, not a GET, so the full name stays out of URLs and access logs.
 */
export const checkUsernameSchema = z.object({
  username: z.string().trim().min(1).max(60),
  /** Optional: seeds better suggestions than mangling the username alone. */
  fullName: z.string().trim().max(120).optional(),
})

export const countrySchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(isSupportedCountry, "Select your country of residence.")

/**
 * Phone is required and country is new.
 *
 * Both columns stay nullable in the database — the accounts migrated from the
 * old platform predate either field, and a NOT NULL on a table that already
 * holds rows without the value simply refuses to migrate. Requiring them here
 * means every account opened from now on has them, without evicting anyone who
 * signed up before they were asked for.
 */
export const registerSchema = z
  .object({
    fullName: z.string().trim().min(3, "Enter your full name.").max(120),
    email: z.email("Enter a valid email address.").trim().toLowerCase(),
    username: usernameSchema,
    country: countrySchema,
    phone: z.string().trim().min(1, "Enter your phone number."),
    password: passwordSchema,
    acceptedTerms: z.literal(true, {
      error: "You must accept the terms to open an account.",
    }),
  })
  .superRefine((value, ctx) => {
    // Only when there is something to judge. An empty phone is already
    // reported by `min(1)`, and an unknown country by `countrySchema` — adding
    // "that number is not valid for the country" on top of either is a second
    // complaint about a field the user has not got to yet.
    if (!value.phone.trim() || !isSupportedCountry(value.country)) return

    if (!toE164(value.phone, value.country)) {
      ctx.addIssue({
        code: "custom",
        // Attached to the field so the form marks the input, not the whole page.
        path: ["phone"],
        message: "Enter a valid phone number for the country you selected.",
      })
    }
  })
  // Stored canonically. Runs only once the refinement above has passed, so the
  // fallback is unreachable — it exists to keep the type a plain string.
  .transform((value) => ({
    ...value,
    phone: toE164(value.phone, value.country) ?? value.phone,
  }))

export const loginSchema = z.object({
  /** Email or username — SwiftEdge accepted either, and so do we. */
  identifier: z.string().trim().min(1, "Enter your email address or username."),
  password: z.string().min(1, "Enter your password."),
  /** False issues a session cookie that dies with the browser. */
  remember: z.boolean().default(true),
})

export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required."),
  password: passwordSchema,
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: passwordSchema,
})

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Confirmation token is required."),
})

export const resendVerificationSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>
