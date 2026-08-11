import { WithdrawalMethod } from "@prisma/client"
import { z } from "zod"

const amount = z.coerce
  .number()
  .positive("Amount must be greater than zero.")
  .max(10_000_000, "Amount exceeds the per-request maximum.")

export const createWithdrawalSchema = z
  .object({
    amount,
    method: z.enum(WithdrawalMethod),
    /** Verified and consumed server-side — SwiftEdge never checked it. */
    pin: z
      .string()
      .regex(/^\d{4}$|^\d{6}$/, "Enter the 4 or 6 digit PIN you were given."),

    // Crypto
    walletAddress: z.string().trim().min(10).max(120).optional(),
    network: z.string().trim().min(2).max(40).optional(),
    currency: z.string().trim().min(2).max(20).optional(),

    // Bank
    bankName: z.string().trim().min(2).max(120).optional(),
    accountName: z.string().trim().min(2).max(120).optional(),
    accountNumber: z.string().trim().min(4).max(40).optional(),
    routingNumber: z.string().trim().min(4).max(40).optional(),
    swiftCode: z.string().trim().min(4).max(20).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.method === WithdrawalMethod.CRYPTO) {
      if (!value.walletAddress) {
        ctx.addIssue({
          code: "custom",
          path: ["walletAddress"],
          message: "A wallet address is required.",
        })
      }
      if (!value.network) {
        ctx.addIssue({
          code: "custom",
          path: ["network"],
          message: "A network is required.",
        })
      }
      return
    }

    for (const field of ["bankName", "accountName", "accountNumber"] as const) {
      if (!value[field]) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "This field is required for bank withdrawals.",
        })
      }
    }
  })

export const processWithdrawalSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional(),
})

export type CreateWithdrawalInput = z.infer<typeof createWithdrawalSchema>
export type ProcessWithdrawalInput = z.infer<typeof processWithdrawalSchema>
