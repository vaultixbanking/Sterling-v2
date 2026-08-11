import type { Server } from "node:http"

// Importing env first means a bad configuration fails before anything else
// starts. SwiftEdge bound the port and *then* discovered its Mongo URI was
// missing, leaving a server that served 500s forever.
import { env } from "./config/env.js"
import { createApp } from "./app.js"
import { startJobs, stopJobs } from "./jobs/index.js"
import { logger } from "./lib/logger.js"
import { checkDatabase, disconnectDatabase } from "./lib/prisma.js"

async function bootstrap(): Promise<void> {
  const databaseReady = await checkDatabase()
  if (!databaseReady) {
    logger.fatal(
      "Could not reach the database. Check DATABASE_URL and that the Supabase project is not paused."
    )
    process.exit(1)
  }

  const app = createApp()
  const server: Server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      "Sterling Edge API listening"
    )
  })

  startJobs()

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Shutting down")
    stopJobs()

    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0))
    })

    // Don't hang forever on a stuck connection.
    setTimeout(() => process.exit(1), 10_000).unref()
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"))
  process.on("SIGINT", () => shutdown("SIGINT"))

  process.on("unhandledRejection", (reason) => {
    logger.error({ err: reason }, "Unhandled promise rejection")
  })
  process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "Uncaught exception — exiting")
    process.exit(1)
  })
}

void bootstrap()
