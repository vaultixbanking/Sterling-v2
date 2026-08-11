import { Router } from "express"
import { z } from "zod"

import { created, noContent, ok } from "../../lib/http.js"
import { asyncHandler } from "../../middleware/async-handler.js"
import { authenticate } from "../../middleware/authenticate.js"
import { validate } from "../../middleware/validate.js"
import * as service from "./plans.service.js"

/** Public — the marketing page reads this. */
export const plansRouter: Router = Router()

plansRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    ok(res, { plans: await service.listPlans() })
  })
)

/** Authenticated. */
export const subscriptionsRouter: Router = Router()

subscriptionsRouter.use(authenticate)

subscriptionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const [subscriptions, available] = await Promise.all([
      service.listSubscriptions(req.auth!.userId),
      service.getAvailableForSubscription(req.auth!.userId),
    ])
    ok(res, { subscriptions, available })
  })
)

subscriptionsRouter.post(
  "/",
  validate({
    body: z.object({
      planSlug: z.string().trim().min(1),
      amount: z.coerce.number().positive(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const subscription = await service.subscribe(
      req.auth!.userId,
      req.body.planSlug,
      req.body.amount
    )
    created(res, { subscription: service.serializeSubscription(subscription) })
  })
)

subscriptionsRouter.post(
  "/:id/cancel",
  validate({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    await service.cancelSubscription(req.auth!.userId, req.params.id as string)
    noContent(res)
  })
)
