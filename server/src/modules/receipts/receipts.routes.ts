import { Router } from "express"
import { z } from "zod"

import { ok } from "../../lib/http.js"
import { asyncHandler } from "../../middleware/async-handler.js"
import { receiptLimiter } from "../../middleware/rate-limit.js"
import { validate } from "../../middleware/validate.js"
import { getReceiptByToken } from "./receipts.service.js"

export const receiptsRouter: Router = Router()

// The token is the whole capability, so the length floor is a cheap way to
// reject obviously junk lookups before they reach the database.
const tokenParam = z.object({ token: z.string().trim().min(20).max(128) })

/**
 * Public and deliberately unauthenticated — the point of a receipt is that it
 * can be forwarded to someone who has no account here. Rate-limited because an
 * unauthenticated lookup answering "does this exist?" is worth a ceiling, even
 * one nobody could realistically brute-force.
 */
receiptsRouter.get(
  "/:token",
  receiptLimiter,
  validate({ params: tokenParam }),
  asyncHandler(async (req, res) => {
    const receipt = await getReceiptByToken(req.params.token as string)
    ok(res, { receipt })
  })
)
