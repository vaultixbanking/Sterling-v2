// Side-effect import: populates process.env from .env before anything is read.
import "./load-env.js"

import { z } from "zod"

/**
 * Every environment variable the API reads, validated once at boot.
 *
 * SwiftEdge read `process.env` ad hoc across 2,338 lines with no validation:
 * a missing MONGO_URI threw an unhandled rejection *after* the port was already
 * bound, and a missing ADMIN_PASSWORD silently seeded `admin`/`admin123`.
 * Here a bad config is a startup failure with a readable message.
 */

const csv = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
  )

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(4000),

    API_URL: z.url(),
    APP_URL: z.url(),
    CORS_ORIGINS: csv.pipe(z.array(z.url()).min(1)),

    DATABASE_URL: z.string().min(1),
    DIRECT_URL: z.string().min(1).optional(),

    JWT_ACCESS_SECRET: z
      .string()
      .min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
    ACCESS_TOKEN_TTL: z.string().default("15m"),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    COOKIE_DOMAIN: z.string().optional(),

    SUPABASE_URL: z.url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    SUPABASE_STORAGE_BUCKET: z.string().default("proofs"),

    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().default("Sterling Edge Trade <noreply@example.com>"),
    SUPPORT_EMAIL: z.email().default("support@sterlingedgetrade.com"),

    SEED_ADMIN_EMAIL: z.email().optional(),
    SEED_ADMIN_USERNAME: z.string().optional(),
    SEED_ADMIN_PASSWORD: z.string().optional(),

    WITHDRAWAL_FEE_PERCENT: z.coerce.number().min(0).max(100).default(5),
    MIN_WITHDRAWAL_USD: z.coerce.number().positive().default(10),
    MIN_DEPOSIT_USD: z.coerce.number().positive().default(250),
  })
  .superRefine((value, ctx) => {
    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_REFRESH_SECRET"],
        message:
          "JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET. Sharing one secret lets an access token be replayed as a refresh token.",
      })
    }

    // Uploads and email degrade gracefully in dev, but must be wired in prod.
    if (value.NODE_ENV === "production") {
      if (!value.SUPABASE_URL || !value.SUPABASE_SERVICE_ROLE_KEY) {
        ctx.addIssue({
          code: "custom",
          path: ["SUPABASE_SERVICE_ROLE_KEY"],
          message:
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production (proof-of-payment uploads).",
        })
      }
      if (!value.RESEND_API_KEY) {
        ctx.addIssue({
          code: "custom",
          path: ["RESEND_API_KEY"],
          message: "RESEND_API_KEY is required in production.",
        })
      }
    }
  })

export type Env = z.infer<typeof envSchema>

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  • ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n")

    // Thrown before the logger exists, so this is the one intentional
    // direct write to stderr in the codebase.
    process.stderr.write(
      `\nInvalid environment configuration:\n${issues}\n\nSee server/.env.example for the full list.\n\n`
    )
    process.exit(1)
  }

  return parsed.data
}

export const env = loadEnv()

export const isProduction = env.NODE_ENV === "production"
export const isTest = env.NODE_ENV === "test"

/** Whether optional integrations are configured. */
export const features = {
  storage: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
  email: Boolean(env.RESEND_API_KEY),
} as const
