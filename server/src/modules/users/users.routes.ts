import { Router } from "express"
import { z } from "zod"

import { ok } from "../../lib/http.js"
import { prisma } from "../../lib/prisma.js"
import { asyncHandler } from "../../middleware/async-handler.js"
import { validate } from "../../middleware/validate.js"
import { changePasswordSchema } from "../auth/auth.schema.js"
import { changePassword, toPublicUser } from "../auth/auth.service.js"

export const usersRouter: Router = Router()

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(3).max(120).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[+]?[\d\s()-]{7,20}$/, "Enter a valid phone number.")
    .nullable()
    .optional(),
})

usersRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.auth!.userId },
    })
    ok(res, { user: toPublicUser(user) })
  })
)

usersRouter.patch(
  "/me",
  validate({ body: updateProfileSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof updateProfileSchema>

    const user = await prisma.user.update({
      where: { id: req.auth!.userId },
      data: {
        ...(body.fullName !== undefined ? { fullName: body.fullName } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
      },
    })

    ok(res, { user: toPublicUser(user) })
  })
)

usersRouter.post(
  "/me/change-password",
  validate({ body: changePasswordSchema }),
  asyncHandler(async (req, res) => {
    await changePassword(req.auth!.userId, req.body)
    ok(res, {
      message: "Password updated. You have been signed out on all devices.",
    })
  })
)
