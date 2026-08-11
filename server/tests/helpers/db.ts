import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient, Role } from "@prisma/client"

import { generateUid, hashPassword } from "../../src/lib/crypto.js"

/**
 * Tests run against a real Postgres so row locks, isolation levels and
 * concurrent transactions behave exactly as they will in production.
 *
 * Set TEST_DATABASE_URL to enable them; otherwise these suites skip.
 */
export const hasDatabase = Boolean(process.env.TEST_DATABASE_URL)

export const testPrisma = hasDatabase
  ? new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL as string,
      }),
    })
  : (null as unknown as PrismaClient)

let counter = 0

export async function createTestUser(
  overrides: { role?: Role } = {}
): Promise<{ id: string; uid: string; email: string }> {
  counter += 1
  const suffix = `${Date.now()}-${counter}`

  const user = await testPrisma.user.create({
    data: {
      uid: generateUid(),
      email: `test-${suffix}@example.test`,
      username: `test_${suffix}`.replace(/-/g, "_").slice(0, 20),
      fullName: "Test User",
      passwordHash: await hashPassword("Password123!"),
      role: overrides.role ?? Role.USER,
    },
  })

  return { id: user.id, uid: user.uid, email: user.email }
}

/** Removes only rows this suite created. */
export async function cleanupTestUsers(): Promise<void> {
  await testPrisma.user.deleteMany({
    where: { email: { endsWith: "@example.test" } },
  })
}
