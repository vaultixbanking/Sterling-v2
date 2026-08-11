import { existsSync } from "node:fs"
import { resolve } from "node:path"

import { defineConfig } from "prisma/config"

// The Prisma CLI is a separate entry point that never imports src/config/env,
// and Prisma 7 no longer loads .env itself — so the same guarded load as
// src/config/load-env.ts has to happen here too.
if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
  const envFile = resolve(process.cwd(), ".env")
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile)
  }
}

/**
 * Prisma 7 reads connection URLs from here rather than from schema.prisma.
 *
 * Migrations must use DIRECT_URL (port 5432). Running them through Supabase's
 * pgBouncer pooler on 6543 fails, because the schema engine needs session-level
 * statements that a transaction pooler will not carry.
 *
 * The application itself connects via the pooled URL — see src/lib/prisma.ts.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
})
