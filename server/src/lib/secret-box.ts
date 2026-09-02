import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto"

import { env } from "../config/env.js"

/**
 * Authenticated encryption for short-lived secrets that have to be readable
 * again — currently only a withdrawal PIN backing a one-time link.
 *
 * **The key is derived, not configured.** HKDF over `JWT_ACCESS_SECRET` with a
 * fixed info string produces a key that exists nowhere in the database and
 * needs no new environment variable, so nothing has to be provisioned on the
 * host before this ships — a deploy step that is easy to forget and fails at
 * exactly the wrong moment. The info string domain-separates it: this key
 * cannot verify a token, and the signing key cannot read a PIN, even though
 * both descend from the same secret.
 *
 * The consequence to know: rotating `JWT_ACCESS_SECRET` makes any unopened PIN
 * link undecryptable. That is acceptable precisely because these live for hours
 * at most — the reveal page reports it as an expired link, which is what it
 * effectively is, and the admin reissues.
 *
 * GCM, not CBC: the ciphertext is stored next to data an attacker with database
 * access could tamper with, and an authentication tag is what turns a silent
 * corruption into a loud failure.
 */

const ALGORITHM = "aes-256-gcm"
const IV_BYTES = 12
const TAG_BYTES = 16

function key(): Buffer {
  return Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(env.JWT_ACCESS_SECRET, "utf8"),
      Buffer.alloc(0),
      Buffer.from("sterling:withdrawal-pin-share:v1", "utf8"),
      32
    )
  )
}

/** `iv.ciphertext.tag`, all base64url — one opaque column value. */
export function sealSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key(), iv)

  const body = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])

  return [
    iv.toString("base64url"),
    body.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".")
}

/**
 * Returns null rather than throwing on anything malformed, tampered with, or
 * encrypted under a since-rotated secret. Every one of those is the same thing
 * to a caller — the PIN cannot be produced — and they are all reported to the
 * reader as an expired link rather than as an error, which is both truthful and
 * gives an attacker nothing to distinguish.
 */
export function openSecret(sealed: string): string | null {
  try {
    const [rawIv, rawBody, rawTag] = sealed.split(".")
    if (!rawIv || !rawBody || !rawTag) return null

    const iv = Buffer.from(rawIv, "base64url")
    const tag = Buffer.from(rawTag, "base64url")
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) return null

    const decipher = createDecipheriv(ALGORITHM, key(), iv)
    decipher.setAuthTag(tag)

    return Buffer.concat([
      decipher.update(Buffer.from(rawBody, "base64url")),
      decipher.final(),
    ]).toString("utf8")
  } catch {
    return null
  }
}
