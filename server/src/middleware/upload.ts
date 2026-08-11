import multer from "multer"

import {
  UPLOAD_ALLOWED_MIME,
  UPLOAD_MAX_BYTES,
} from "../config/constants.js"
import { AppError } from "../lib/errors.js"

/**
 * In-memory upload for a single proof-of-payment file, streamed straight to
 * Supabase Storage. Nothing is written to local disk — on an ephemeral host
 * that would vanish on the next deploy.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!UPLOAD_ALLOWED_MIME.includes(file.mimetype as never)) {
      callback(
        new AppError(
          415,
          "UNSUPPORTED_MEDIA_TYPE",
          `Unsupported file type. Allowed: ${UPLOAD_ALLOWED_MIME.join(", ")}.`
        )
      )
      return
    }
    callback(null, true)
  },
})

export const uploadProofFile = upload.single("proof")
