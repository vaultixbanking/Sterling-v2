import { randomUUID } from "node:crypto"
import path from "node:path"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { env, features } from "../config/env.js"
import { ServiceUnavailableError } from "./errors.js"
import { logger } from "./logger.js"

/**
 * Supabase Storage wrapper for proof-of-payment uploads.
 *
 * The bucket is private: files are never publicly addressable, and admins read
 * them through short-lived signed URLs. SwiftEdge had no upload capability at
 * all — its frontend showed a file input that submitted nowhere.
 */

let client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (!features.storage) {
    throw new ServiceUnavailableError(
      "File uploads are not configured on this environment."
    )
  }

  client ??= createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return client
}

export interface UploadedFile {
  buffer: Buffer
  originalname: string
  mimetype: string
  size: number
}

/** Returns the object path to persist on the deposit request. */
export async function uploadProof(
  userId: string,
  file: UploadedFile
): Promise<string> {
  const extension = path.extname(file.originalname).toLowerCase().slice(0, 10)
  // User-supplied filenames never touch the object key.
  const objectPath = `${userId}/${Date.now()}-${randomUUID()}${extension}`

  const { error } = await getClient()
    .storage.from(env.SUPABASE_STORAGE_BUCKET)
    .upload(objectPath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    })

  if (error) {
    logger.error({ err: error, userId }, "Proof upload failed")
    throw new ServiceUnavailableError("Could not store the uploaded file.")
  }

  return objectPath
}

/** Short-lived signed URL so admins can view a proof without a public bucket. */
export async function getProofUrl(
  objectPath: string,
  expiresInSeconds = 300
): Promise<string | null> {
  const { data, error } = await getClient()
    .storage.from(env.SUPABASE_STORAGE_BUCKET)
    .createSignedUrl(objectPath, expiresInSeconds)

  if (error) {
    logger.warn({ err: error, objectPath }, "Could not sign proof URL")
    return null
  }

  return data.signedUrl
}

export async function deleteProof(objectPath: string): Promise<void> {
  const { error } = await getClient()
    .storage.from(env.SUPABASE_STORAGE_BUCKET)
    .remove([objectPath])

  if (error) {
    logger.warn({ err: error, objectPath }, "Could not delete proof")
  }
}
