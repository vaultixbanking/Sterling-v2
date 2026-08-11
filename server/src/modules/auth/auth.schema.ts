import { z } from "zod"

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

export const registerSchema = z.object({
  fullName: z.string().trim().min(3, "Enter your full name.").max(120),
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  username: usernameSchema,
  phone: z
    .string()
    .trim()
    .regex(/^[+]?[\d\s()-]{7,20}$/, "Enter a valid phone number.")
    .optional()
    .or(z.literal("")),
  password: passwordSchema,
  acceptedTerms: z.literal(true, {
    error: "You must accept the terms to open an account.",
  }),
})

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

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
