import cron, { type ScheduledTask } from "node-cron"

import { logger } from "../lib/logger.js"
import { checkDatabase } from "../lib/prisma.js"
import { accrueDailyReturns } from "../modules/plans/plans.service.js"
import { expireStalePins } from "../modules/pins/pins.service.js"

/**
 * Scheduled work.
 *
 * SwiftEdge ran a per-minute cron purely to flip PIN statuses, duplicated on
 * every replica, and doing work its own verification path already handled.
 * Here expiry is enforced at read time and the job is only housekeeping.
 */

const tasks: ScheduledTask[] = []

function schedule(name: string, expression: string, run: () => Promise<void>) {
  const task = cron.schedule(
    expression,
    () => {
      void run().catch((error: unknown) => {
        logger.error({ err: error, job: name }, "Scheduled job failed")
      })
    },
    { timezone: "UTC" }
  )
  tasks.push(task)
  logger.info({ job: name, expression }, "Scheduled job registered")
}

export function startJobs(): void {
  // Hourly: mark expired PINs. Expiry is already checked at verification time,
  // so this is only to keep the table tidy for the admin view.
  schedule("expire-pins", "0 * * * *", async () => {
    const count = await expireStalePins()
    if (count > 0) logger.info({ count }, "Expired stale withdrawal PINs")
  })

  // Daily at 00:05 UTC: accrue plan returns. Idempotent per UTC day.
  schedule("accrue-plan-returns", "5 0 * * *", async () => {
    const result = await accrueDailyReturns()
    logger.info(result, "Accrued daily plan returns")
  })

  // Every 3 days: touch the database so a Supabase free project never idles
  // out. Their free tier pauses a project after 7 days without activity.
  schedule("keep-alive", "0 3 */3 * *", async () => {
    const healthy = await checkDatabase()
    logger.info({ healthy }, "Keep-alive ping")
  })
}

export function stopJobs(): void {
  for (const task of tasks) {
    void task.stop()
  }
  tasks.length = 0
}
