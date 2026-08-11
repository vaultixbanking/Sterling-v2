import { existsSync } from "node:fs"
import { resolve } from "node:path"

/**
 * Loads `.env` into `process.env` for local development.
 *
 * Imported for its side effect, and only from `config/env.ts` and
 * `prisma.config.ts` — the two places that read configuration before anything
 * else runs. Node has read `.env` natively since 20.12, so this needs no
 * dependency.
 *
 * Skipped entirely when `DATABASE_URL` is already present, which is the case in
 * production (the platform injects it), in CI, and under Vitest (the test setup
 * sets it). An environment that has already been configured is never
 * second-guessed by a file on disk.
 */
if (!process.env.DATABASE_URL) {
  const envFile = resolve(process.cwd(), ".env")
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile)
  }
}
