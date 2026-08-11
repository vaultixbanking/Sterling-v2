import { Router } from "express"

import { ok } from "../../lib/http.js"
import { serialize } from "../../lib/money.js"
import { prisma } from "../../lib/prisma.js"
import { asyncHandler } from "../../middleware/async-handler.js"

export const holdingsRouter: Router = Router()

holdingsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const holdings = await prisma.holding.findMany({
      where: { userId: req.auth!.userId, archivedAt: null },
      orderBy: { createdAt: "desc" },
    })

    ok(res, {
      holdings: holdings.map((holding) => ({
        id: holding.id,
        name: holding.name,
        symbol: holding.symbol,
        units: holding.units.toString(),
        valueUsd: serialize(holding.valueUsd),
        createdAt: holding.createdAt,
      })),
    })
  })
)
