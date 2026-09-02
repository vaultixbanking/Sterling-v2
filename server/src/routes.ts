import { Router } from "express"

import { checkDatabase } from "./lib/prisma.js"
import { authenticate } from "./middleware/authenticate.js"
import { adminRouter } from "./modules/admin/admin.routes.js"
import { authRouter } from "./modules/auth/auth.routes.js"
import { depositsRouter } from "./modules/deposits/deposits.routes.js"
import { holdingsRouter } from "./modules/holdings/holdings.routes.js"
import { pinShareRouter } from "./modules/pins/pins.routes.js"
import { plansRouter, subscriptionsRouter } from "./modules/plans/plans.routes.js"
import { portfolioRouter } from "./modules/portfolio/portfolio.routes.js"
import { receiptsRouter } from "./modules/receipts/receipts.routes.js"
import { transactionsRouter } from "./modules/transactions/transactions.routes.js"
import { usersRouter } from "./modules/users/users.routes.js"
import { withdrawalsRouter } from "./modules/withdrawals/withdrawals.routes.js"

export const apiRouter: Router = Router()

/** Public. Unlike SwiftEdge's, this actually checks the database. */
apiRouter.get("/health", async (_req, res) => {
  const database = await checkDatabase()
  res.status(database ? 200 : 503).json({
    success: database,
    data: { status: database ? "healthy" : "degraded", database },
  })
})

// ---- public --------------------------------------------------------------
apiRouter.use("/auth", authRouter)
apiRouter.use("/plans", plansRouter)
// Reachable by anyone holding the link — that is the point of a receipt.
apiRouter.use("/receipts", receiptsRouter)
// The token is the capability; the PIN itself needs an explicit POST to reveal.
apiRouter.use("/pin-links", pinShareRouter)

// ---- authenticated -------------------------------------------------------
apiRouter.use("/users", authenticate, usersRouter)
apiRouter.use("/portfolio", authenticate, portfolioRouter)
apiRouter.use("/transactions", authenticate, transactionsRouter)
apiRouter.use("/holdings", authenticate, holdingsRouter)
apiRouter.use("/deposits", authenticate, depositsRouter)
apiRouter.use("/withdrawals", authenticate, withdrawalsRouter)
apiRouter.use("/subscriptions", subscriptionsRouter)

// ---- admin (authenticate + requireAdmin applied inside) -------------------
apiRouter.use("/admin", adminRouter)
