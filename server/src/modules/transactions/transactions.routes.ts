import { TxCategory, TxStatus, TxType, type Prisma } from "@prisma/client"
import { Router } from "express"
import { z } from "zod"

import { buildPageMeta, paginated } from "../../lib/http.js"
import { serialize } from "../../lib/money.js"
import { paginationSchema, toSkipTake } from "../../lib/pagination.js"
import { prisma } from "../../lib/prisma.js"
import { asyncHandler } from "../../middleware/async-handler.js"
import { validate } from "../../middleware/validate.js"

export const transactionsRouter: Router = Router()

const querySchema = paginationSchema.extend({
  type: z.enum(TxType).optional(),
  status: z.enum(TxStatus).optional(),
  category: z.enum(TxCategory).optional(),
})

transactionsRouter.get(
  "/",
  validate({ query: querySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof querySchema>

    const where: Prisma.TransactionWhereInput = {
      userId: req.auth!.userId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...toSkipTake(query),
      }),
      prisma.transaction.count({ where }),
    ])

    paginated(
      res,
      items.map((tx) => ({
        id: tx.id,
        type: tx.type,
        category: tx.category,
        amount: serialize(tx.amount),
        status: tx.status,
        description: tx.description,
        metadata: tx.metadata,
        createdAt: tx.createdAt,
      })),
      buildPageMeta(query.page, query.limit, total)
    )
  })
)
