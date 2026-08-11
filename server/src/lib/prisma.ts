import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

import { env, isProduction } from "../config/env.js"

/**
 * Prisma 7 connects through a driver adapter rather than a schema-level URL.
 *
 * `DATABASE_URL` should be Supabase's pooled connection (pgBouncer, port 6543).
 * Migrations use `DIRECT_URL` instead — see prisma.config.ts.
 */
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL })

const createClient = () =>
  new PrismaClient({
    adapter,
    log: isProduction ? ["warn", "error"] : ["warn", "error"],
  })

// tsx watch reloads this module on every change; without the global cache each
// reload would open a fresh pool and eventually exhaust Postgres connections.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (!isProduction) {
  globalForPrisma.prisma = prisma
}

/** Used by GET /health — SwiftEdge's health check never touched the database. */
export async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch {
    return false
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect()
}
