import { Router } from "express"

import { asyncHandler } from "../../middleware/async-handler.js"
import { authenticate } from "../../middleware/authenticate.js"
import {
  authLimiter,
  passwordResetLimiter,
  refreshLimiter,
} from "../../middleware/rate-limit.js"
import { validate } from "../../middleware/validate.js"
import * as controller from "./auth.controller.js"
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "./auth.schema.js"

export const authRouter: Router = Router()

authRouter.post(
  "/register",
  authLimiter,
  validate({ body: registerSchema }),
  asyncHandler(controller.register)
)

authRouter.post(
  "/login",
  authLimiter,
  validate({ body: loginSchema }),
  asyncHandler(controller.login)
)

authRouter.post("/refresh", refreshLimiter, asyncHandler(controller.refresh))

authRouter.post("/logout", asyncHandler(controller.logout))

authRouter.post(
  "/logout-all",
  authenticate,
  asyncHandler(controller.logoutAll)
)

authRouter.post(
  "/forgot-password",
  passwordResetLimiter,
  validate({ body: forgotPasswordSchema }),
  asyncHandler(controller.forgotPassword)
)

authRouter.post(
  "/reset-password",
  passwordResetLimiter,
  validate({ body: resetPasswordSchema }),
  asyncHandler(controller.resetPassword)
)

authRouter.get("/me", authenticate, asyncHandler(controller.me))
