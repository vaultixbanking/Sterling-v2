import { Router } from "express"
import { z } from "zod"

import { PERFORMANCE_PERIODS } from "../../config/constants.js"
import { ok } from "../../lib/http.js"
import { asyncHandler } from "../../middleware/async-handler.js"
import { validate } from "../../middleware/validate.js"
import * as service from "./portfolio.service.js"

export const portfolioRouter: Router = Router()

portfolioRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    ok(res, await service.getSummary(req.auth!.userId))
  })
)

portfolioRouter.get(
  "/performance",
  validate({
    query: z.object({
      // SwiftEdge accepted anything and silently fell through to "all".
      period: z.enum(PERFORMANCE_PERIODS).default("7d"),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { period } = req.query as unknown as {
      period: (typeof PERFORMANCE_PERIODS)[number]
    }
    ok(res, await service.getPerformance(req.auth!.userId, period))
  })
)
