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

/**
 * `role` is returned as well as accepted: the HTTP harness signs a token from
 * this object, and a token minted without the role is a `USER` token — which
 * makes every admin request 403 for a reason that looks nothing like the cause.
 *
 * `fullName` is returned for the same class of reason: the receipt suite
 * asserts on the name the document shows, and hard-coding "Test User" in the
 * test would pass just as happily if the API returned somebody else's.
 */
export async function createTestUser(
  overrides: { role?: Role } = {}
): Promise<{
  id: string
  uid: string
  email: string
  username: string
  fullName: string
  role: Role
}> {
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

  return {
    id: user.id,
    uid: user.uid,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
  }
}

/** Removes only rows this suite created. */
export async function cleanupTestUsers(): Promise<void> {
  await testPrisma.user.deleteMany({
    where: { email: { endsWith: "@example.test" } },
  })
}
