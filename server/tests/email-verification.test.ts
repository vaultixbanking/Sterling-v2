import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { generateToken, hashToken } from "../src/lib/crypto.js"
import { describeDevice } from "../src/lib/user-agent.js"
import {
  notifyIfNewDevice,
  requestEmailVerification,
  verifyEmail,
} from "../src/modules/auth/auth.service.js"
import { cleanupTestUsers, createTestUser, hasDatabase, testPrisma } from "./helpers/db.js"

const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
const CHROME_MAC_NEWER = CHROME_MAC.replace("141.0.0.0", "148.0.0.0")
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
const EDGE_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0"

describe("describeDevice", () => {
  it("names common browser/platform pairs", () => {
    expect(describeDevice(CHROME_MAC)).toBe("Chrome on macOS")
    expect(describeDevice(SAFARI_IPHONE)).toBe("Safari on iPhone")
  })

  it("does not mistake Edge for Chrome", () => {
    // Edge's UA contains "Chrome/", so a naive check reports the wrong browser.
    expect(describeDevice(EDGE_WINDOWS)).toBe("Edge on Windows")
  })

  it("does not mistake iOS for macOS", () => {
    // iOS user agents also carry "Mac OS X".
    expect(describeDevice(SAFARI_IPHONE)).not.toContain("macOS")
  })

  it("returns null rather than inventing a device", () => {
    expect(describeDevice("")).toBeNull()
    expect(describeDevice(null)).toBeNull()
    expect(describeDevice(undefined)).toBeNull()
  })

  it("treats a browser version bump as the same device", () => {
    // The whole point: matching raw agents would alert on every Chrome update.
    expect(describeDevice(CHROME_MAC)).toBe(describeDevice(CHROME_MAC_NEWER))
  })
})

describe.skipIf(!hasDatabase)("email verification", () => {
  beforeAll(async () => {
    await cleanupTestUsers()
  })

  afterAll(async () => {
    await cleanupTestUsers()
    await testPrisma.$disconnect()
  })

  it("stores only a hash of the token", async () => {
    const user = await createTestUser()
    await requestEmailVerification(user.id)

    const record = await testPrisma.emailVerificationToken.findFirstOrThrow({
      where: { userId: user.id },
    })

    expect(record.tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(record.usedAt).toBeNull()
  })

  it("supersedes the previous token so only the newest link works", async () => {
    const user = await createTestUser()

    await requestEmailVerification(user.id)
    const first = await testPrisma.emailVerificationToken.findFirstOrThrow({
      where: { userId: user.id },
    })

    await requestEmailVerification(user.id)

    const superseded = await testPrisma.emailVerificationToken.findUniqueOrThrow({
      where: { id: first.id },
    })
    expect(superseded.usedAt).not.toBeNull()

    const live = await testPrisma.emailVerificationToken.count({
      where: { userId: user.id, usedAt: null },
    })
    expect(live).toBe(1)
  })

  it("rejects an unknown token", async () => {
    await expect(verifyEmail("not-a-real-token")).rejects.toThrow()
  })

  it("rejects an expired token", async () => {
    const user = await createTestUser()
    const token = generateToken(32)

    await testPrisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() - 1000),
      },
    })

    await expect(verifyEmail(token)).rejects.toThrow()

    const after = await testPrisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(after.emailVerifiedAt).toBeNull()
  })

  it("verifies a valid token and consumes it", async () => {
    const user = await createTestUser()
    const token = generateToken(32)

    await testPrisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 60_000),
      },
    })

    await verifyEmail(token)

    const after = await testPrisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(after.emailVerifiedAt).not.toBeNull()

    const record = await testPrisma.emailVerificationToken.findUniqueOrThrow({
      where: { tokenHash: hashToken(token) },
    })
    expect(record.usedAt).not.toBeNull()
  })

  it("treats a stale link on an already-verified account as success", async () => {
    // Clicking yesterday's email should not present an error to someone whose
    // address is already confirmed.
    const user = await createTestUser()
    const token = generateToken(32)

    await testPrisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 60_000),
      },
    })
    await testPrisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    })

    await expect(verifyEmail(token)).resolves.toMatchObject({ id: user.id })
  })

  it("issues nothing once the address is verified", async () => {
    const user = await createTestUser()
    await testPrisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    })

    await requestEmailVerification(user.id)

    const count = await testPrisma.emailVerificationToken.count({
      where: { userId: user.id },
    })
    expect(count).toBe(0)
  })
})

describe.skipIf(!hasDatabase)("new-device login alerts", () => {
  afterAll(async () => {
    await cleanupTestUsers()
    await testPrisma.$disconnect()
  })

  const session = (userId: string, userAgent: string) =>
    testPrisma.refreshSession.create({
      data: {
        userId,
        tokenHash: hashToken(generateToken(32)),
        userAgent,
        ip: "203.0.113.10",
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    })

  const load = (id: string) => testPrisma.user.findUniqueOrThrow({ where: { id } })

  it("stays silent on the first ever sign-in", async () => {
    // Nothing to compare against — and the 49 migrated accounts all start here.
    const user = await load((await createTestUser()).id)
    await expect(notifyIfNewDevice(user, { userAgent: CHROME_MAC })).resolves.toBe(false)
  })

  it("stays silent on a device already seen", async () => {
    const user = await load((await createTestUser()).id)
    await session(user.id, CHROME_MAC)

    await expect(notifyIfNewDevice(user, { userAgent: CHROME_MAC })).resolves.toBe(false)
  })

  it("stays silent after a browser version bump", async () => {
    const user = await load((await createTestUser()).id)
    await session(user.id, CHROME_MAC)

    await expect(
      notifyIfNewDevice(user, { userAgent: CHROME_MAC_NEWER })
    ).resolves.toBe(false)
  })

  it("alerts on a genuinely new device", async () => {
    const user = await load((await createTestUser()).id)
    await session(user.id, CHROME_MAC)

    await expect(
      notifyIfNewDevice(user, { userAgent: SAFARI_IPHONE, ip: "198.51.100.7" })
    ).resolves.toBe(true)
  })
})
