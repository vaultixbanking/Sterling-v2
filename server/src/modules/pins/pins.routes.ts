import { Router } from "express"
import { z } from "zod"

import { ok } from "../../lib/http.js"
import { asyncHandler } from "../../middleware/async-handler.js"
import { receiptLimiter } from "../../middleware/rate-limit.js"
import { validate } from "../../middleware/validate.js"
import { revealPinShare, viewPinShare } from "./pins.service.js"

export const pinShareRouter: Router = Router()

const tokenParam = z.object({ token: z.string().trim().min(20).max(128) })

/**
 * Two endpoints rather than one, and the split is the entire security design.
 *
 * GET describes the link — who it is for, when it expires, whether it has been
 * used — and never returns the PIN. It is safe for a chat app's link-preview
 * crawler to fetch, which it will, unbidden, the moment the admin sends the
 * message.
 *
 * POST spends it. A one-time secret that burned on GET would be consumed by
 * that crawler before the recipient ever tapped anything, and the client would
 * be handed a link that was already dead.
 */
pinShareRouter.get(
  "/:token",
  receiptLimiter,
  validate({ params: tokenParam }),
  asyncHandler(async (req, res) => {
    ok(res, { share: await viewPinShare(req.params.token as string) })
  })
)

pinShareRouter.post(
  "/:token/reveal",
  receiptLimiter,
  validate({ params: tokenParam }),
  asyncHandler(async (req, res) => {
    ok(res, { pin: await revealPinShare(req.params.token as string) })
  })
)
