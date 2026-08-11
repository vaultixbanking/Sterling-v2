import cookieParser from "cookie-parser"
import cors from "cors"
import express, { type Express } from "express"
import helmet from "helmet"
import { pinoHttp } from "pino-http"

import { JSON_BODY_LIMIT } from "./config/constants.js"
import { env, isProduction, isTest } from "./config/env.js"
import { ForbiddenError } from "./lib/errors.js"
import { logger } from "./lib/logger.js"
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js"
import { generalLimiter } from "./middleware/rate-limit.js"
import { apiRouter } from "./routes.js"

export function createApp(): Express {
  const app = express()

  // Behind Render/Vercel/nginx — needed for correct req.ip and rate limiting.
  app.set("trust proxy", 1)
  app.disable("x-powered-by")

  app.use(helmet())

  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin, curl and server-to-server requests send no Origin.
        if (!origin) return callback(null, true)
        if (env.CORS_ORIGINS.includes(origin)) return callback(null, true)
        // A clean 403 rather than SwiftEdge's 500 HTML stack page.
        callback(new ForbiddenError(`Origin ${origin} is not allowed.`))
      },
      // Required for the httpOnly refresh cookie.
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 86_400,
    })
  )

  if (!isTest) {
    app.use(
      pinoHttp({
        logger,
        // Health checks would otherwise dominate the logs.
        autoLogging: {
          ignore: (req: { url?: string }) => req.url === "/api/v1/health",
        },
      })
    )
  }

  app.use(express.json({ limit: JSON_BODY_LIMIT }))
  app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }))
  app.use(cookieParser())

  app.use(generalLimiter)

  app.use("/api/v1", apiRouter)

  // The API serves JSON only. SwiftEdge's backend also served the frontend
  // from ../frontend, which is Next.js's job here.
  app.use(notFoundHandler)
  app.use(errorHandler)

  if (isProduction) {
    logger.info({ origins: env.CORS_ORIGINS }, "CORS allowlist")
  }

  return app
}
