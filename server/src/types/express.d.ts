import type { Role } from "@prisma/client"

declare global {
  namespace Express {
    interface Request {
      /** Set by the `authenticate` middleware. Absent on public routes. */
      auth?: {
        userId: string
        role: Role
      }
    }
  }
}

export {}
