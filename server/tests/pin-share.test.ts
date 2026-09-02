import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { openSecret, sealSecret } from "../src/lib/secret-box.js"
import { anon, as } from "./helpers/api.js"
import {
  cleanupTestUsers,
  createTestUser,
  hasDatabase,
  testPrisma,
} from "./helpers/db.js"

describe("secret box", () => {
  it("round-trips a value", () => {
    expect(openSecret(sealSecret("418302"))).toBe("418302")
  })

  it("produces a different ciphertext each time for the same input", () => {
    expect(sealSecret("418302")).not.toBe(sealSecret("418302"))
  })

  /** GCM's tag is the reason a tampered row fails loudly instead of decoding. */
  it("refuses a tampered ciphertext rather than returning garbage", () => {
    const sealed = sealSecret("418302")
    const [iv, body, tag] = sealed.split(".")
    const flipped = Buffer.from(body!, "base64url")
    flipped.writeUInt8(flipped.readUInt8(0) ^ 0xff, 0)

    expect(openSecret(`${iv}.${flipped.toString("base64url")}.${tag}`)).toBeNull()
  })

  it("returns null on malformed input instead of throwing", () => {
    expect(openSecret("nonsense")).toBeNull()
    expect(openSecret("")).toBeNull()
  })
})

describe.skipIf(!hasDatabase)("one-time PIN link", () => {
  let admin: Awaited<ReturnType<typeof createTestUser>>
  let user: Awaited<ReturnType<typeof createTestUser>>

  beforeAll(async () => {
    await cleanupTestUsers()
    admin = await createTestUser({ role: "ADMIN" })
    user = await createTestUser()
  })

  afterAll(async () => {
    await cleanupTestUsers()
    await testPrisma.$disconnect()
  })

  async function issue(shareLink: boolean) {
    const response = await as(admin, "post", `/admin/users/${user.uid}/pins`)
      .send({ length: 6, ttlMinutes: 60, notifyUser: false, shareLink })
      .expect(201)
    return response.body.data as { pin: string; shareUrl?: string }
  }

  function tokenOf(shareUrl: string): string {
    return shareUrl.split("/pin/")[1]!
  }

  /**
   * The default has to stay "no readable copy anywhere". A PIN that is only ever
   * read out over the phone should leave nothing behind but its bcrypt hash.
   */
  it("stores nothing readable unless a link was asked for", async () => {
    await issue(false)

    const record = await testPrisma.withdrawalPin.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    })

    expect(record?.shareToken).toBeNull()
    expect(record?.pinCipher).toBeNull()
  })

  it("returns a link when asked, and never the PIN in plaintext at rest", async () => {
    const issued = await issue(true)
    expect(issued.shareUrl).toContain("/pin/")

    const record = await testPrisma.withdrawalPin.findFirst({
      where: { shareToken: tokenOf(issued.shareUrl!) },
    })

    expect(record?.pinCipher).toBeTruthy()
    expect(record?.pinCipher).not.toContain(issued.pin)
  })

  /**
   * The property the whole two-endpoint split exists for. WhatsApp fetches every
   * URL it is sent; if that GET spent the link, the recipient would always be
   * handed a dead one.
   */
  it("does not reveal or spend the PIN on a plain fetch", async () => {
    const issued = await issue(true)
    const token = tokenOf(issued.shareUrl!)

    const response = await anon("get", `/pin-links/${token}`).expect(200)

    expect(JSON.stringify(response.body)).not.toContain(issued.pin)
    expect(response.body.data.share.state).toBe("READY")

    // Still spendable afterwards — the crawler changed nothing.
    const revealed = await anon("post", `/pin-links/${token}/reveal`).expect(200)
    expect(revealed.body.data.pin).toBe(issued.pin)
  })

  it("reveals exactly once, then refuses and destroys the stored copy", async () => {
    const issued = await issue(true)
    const token = tokenOf(issued.shareUrl!)

    const first = await anon("post", `/pin-links/${token}/reveal`).expect(200)
    expect(first.body.data.pin).toBe(issued.pin)

    await anon("post", `/pin-links/${token}/reveal`).expect(400)

    const record = await testPrisma.withdrawalPin.findFirst({
      where: { shareToken: token },
    })
    expect(record?.pinCipher).toBeNull()
    expect(record?.revealedAt).not.toBeNull()
  })

  it("reports a spent link as revealed rather than erroring", async () => {
    const issued = await issue(true)
    const token = tokenOf(issued.shareUrl!)
    await anon("post", `/pin-links/${token}/reveal`).expect(200)

    const response = await anon("get", `/pin-links/${token}`).expect(200)
    expect(response.body.data.share.state).toBe("REVEALED")
  })

  it("404s an unknown token", async () => {
    await anon("get", `/pin-links/${"z".repeat(32)}`).expect(404)
  })
})
