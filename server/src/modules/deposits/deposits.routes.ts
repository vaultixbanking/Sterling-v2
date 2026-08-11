import { DepositMethod } from "@prisma/client"
import { Router } from "express"
import { z } from "zod"

import { created, ok } from "../../lib/http.js"
import { serialize } from "../../lib/money.js"
import { asyncHandler } from "../../middleware/async-handler.js"
import { uploadProofFile } from "../../middleware/upload.js"
import { validate } from "../../middleware/validate.js"
import * as service from "./deposits.service.js"

export const depositsRouter: Router = Router()

const createSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  method: z.enum(DepositMethod),
  reference: z.string().trim().max(200).optional(),
})

depositsRouter.get(
  "/methods",
  asyncHandler(async (_req, res) => {
    ok(res, await service.getPaymentMethods())
  })
)

depositsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const deposits = await service.listForUser(req.auth!.userId)
    ok(res, {
      deposits: deposits.map((deposit) => ({
        id: deposit.id,
        amount: serialize(deposit.amount),
        method: deposit.method,
        reference: deposit.reference,
        status: deposit.status,
        reviewNote: deposit.reviewNote,
        hasProof: Boolean(deposit.proofPath),
        createdAt: deposit.createdAt,
      })),
    })
  })
)

depositsRouter.post(
  "/",
  // multipart/form-data: the proof file plus the text fields.
  uploadProofFile,
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const deposit = await service.createDeposit(
      req.auth!.userId,
      req.body,
      req.file
    )

    created(res, {
      deposit: {
        id: deposit.id,
        amount: serialize(deposit.amount),
        method: deposit.method,
        status: deposit.status,
        createdAt: deposit.createdAt,
      },
    })
  })
)
