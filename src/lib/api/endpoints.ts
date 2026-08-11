import { request } from "./client"
import type {
  AdminDepositRow,
  AdminPin,
  AdminStats,
  AdminUserDetail,
  AdminUserListItem,
  AdminWithdrawalRow,
  AuditLogEntry,
  CreateWithdrawalInput,
  DepositMethod,
  DepositMethods,
  DepositRequest,
  HoldingSummary,
  IssuedPin,
  LoginInput,
  Paginated,
  PaymentMethodConfig,
  PerformancePeriod,
  PerformanceSeries,
  Plan,
  PortfolioSummary,
  PublicUser,
  RegisterInput,
  RequestStatus,
  SessionPayload,
  Subscription,
  Transaction,
  TxCategory,
  TxStatus,
  TxType,
  UserStatus,
  WithdrawalLimits,
  WithdrawalRequest,
} from "./types"

/**
 * One typed function per endpoint, grouped by the module that serves it.
 *
 * Nothing else in the app calls `request()` directly — so when a route changes,
 * this file is the only place that has to know.
 */

export const auth = {
  register: (input: RegisterInput) =>
    request<{ user: PublicUser }>("/auth/register", {
      method: "POST",
      body: input,
    }),

  login: (input: LoginInput) =>
    request<SessionPayload>("/auth/login", { method: "POST", body: input }),

  logout: () => request<void>("/auth/logout", { method: "POST" }),

  logoutEverywhere: () =>
    request<void>("/auth/logout-all", { method: "POST" }),

  forgotPassword: (email: string) =>
    request<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: { email },
    }),

  resetPassword: (token: string, password: string) =>
    request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: { token, password },
    }),

  me: () => request<{ user: PublicUser }>("/auth/me"),
}

export const users = {
  me: () => request<{ user: PublicUser }>("/users/me"),

  updateProfile: (input: { fullName?: string; phone?: string | null }) =>
    request<{ user: PublicUser }>("/users/me", {
      method: "PATCH",
      body: input,
    }),

  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    request<{ message: string }>("/users/me/change-password", {
      method: "POST",
      body: input,
    }),
}

export const portfolio = {
  summary: () => request<PortfolioSummary>("/portfolio"),

  performance: (period: PerformancePeriod) =>
    request<PerformanceSeries>("/portfolio/performance", { query: { period } }),
}

export const transactions = {
  list: (params: {
    page?: number
    limit?: number
    type?: TxType
    status?: TxStatus
    category?: TxCategory
  } = {}) => request<Paginated<Transaction>>("/transactions", { query: params }),
}

export const holdings = {
  list: () => request<{ holdings: HoldingSummary[] }>("/holdings"),
}

export const deposits = {
  methods: () => request<DepositMethods>("/deposits/methods"),

  list: () => request<{ deposits: DepositRequest[] }>("/deposits"),

  /** multipart/form-data — the proof file rides along under `proof`. */
  create: (input: {
    amount: number
    method: DepositMethod
    reference?: string
    proof?: File | null
  }) => {
    const form = new FormData()
    form.append("amount", String(input.amount))
    form.append("method", input.method)
    if (input.reference) form.append("reference", input.reference)
    if (input.proof) form.append("proof", input.proof)

    return request<{ deposit: DepositRequest }>("/deposits", {
      method: "POST",
      body: form,
    })
  },
}

export const withdrawals = {
  list: () =>
    request<{ withdrawals: WithdrawalRequest[]; limits: WithdrawalLimits }>(
      "/withdrawals"
    ),

  create: (input: CreateWithdrawalInput) =>
    request<{ withdrawal: WithdrawalRequest }>("/withdrawals", {
      method: "POST",
      body: input,
    }),

  cancel: (id: string) =>
    request<void>(`/withdrawals/${id}/cancel`, { method: "POST" }),
}

export const plans = {
  /** Public — no token required. */
  list: () => request<{ plans: Plan[] }>("/plans"),
}

export const subscriptions = {
  list: () =>
    request<{ subscriptions: Subscription[]; available: string }>(
      "/subscriptions"
    ),

  create: (planSlug: string, amount: number) =>
    request<{ subscription: Subscription }>("/subscriptions", {
      method: "POST",
      body: { planSlug, amount },
    }),

  cancel: (id: string) =>
    request<void>(`/subscriptions/${id}/cancel`, { method: "POST" }),
}

export const admin = {
  stats: () => request<AdminStats>("/admin/stats"),

  users: (params: {
    page?: number
    limit?: number
    search?: string
    status?: UserStatus
  } = {}) =>
    request<Paginated<AdminUserListItem>>("/admin/users", { query: params }),

  user: (uid: string) => request<AdminUserDetail>(`/admin/users/${uid}`),

  setUserStatus: (uid: string, status: UserStatus) =>
    request<{ message: string }>(`/admin/users/${uid}/status`, {
      method: "PATCH",
      body: { status },
    }),

  adjust: (
    uid: string,
    input: {
      direction: "credit" | "debit"
      amount: number
      category?: TxCategory
      description?: string
      notify?: boolean
    }
  ) =>
    request<unknown>(`/admin/users/${uid}/adjustments`, {
      method: "POST",
      body: input,
    }),

  addHolding: (
    uid: string,
    input: {
      name: string
      symbol: string
      units: number
      valueUsd: number
      creditLedger: boolean
    }
  ) =>
    request<{ holding: HoldingSummary }>(`/admin/users/${uid}/holdings`, {
      method: "POST",
      body: input,
    }),

  updateHolding: (id: string, input: { units?: number; valueUsd?: number }) =>
    request<{ holding: HoldingSummary }>(`/admin/holdings/${id}`, {
      method: "PATCH",
      body: input,
    }),

  archiveHolding: (id: string) =>
    request<void>(`/admin/holdings/${id}`, { method: "DELETE" }),

  deposits: (params: { page?: number; limit?: number; status?: RequestStatus } = {}) =>
    request<Paginated<AdminDepositRow>>("/admin/deposits", { query: params }),

  depositProof: (id: string) =>
    request<{ url: string }>(`/admin/deposits/${id}/proof`),

  processDeposit: (id: string, action: "approve" | "reject", note?: string) =>
    request<{ message: string }>(`/admin/deposits/${id}/process`, {
      method: "POST",
      body: { action, ...(note ? { note } : {}) },
    }),

  withdrawals: (params: { page?: number; limit?: number; status?: RequestStatus } = {}) =>
    request<Paginated<AdminWithdrawalRow>>("/admin/withdrawals", {
      query: params,
    }),

  processWithdrawal: (id: string, action: "approve" | "reject", note?: string) =>
    request<{ message: string }>(`/admin/withdrawals/${id}/process`, {
      method: "POST",
      body: { action, ...(note ? { note } : {}) },
    }),

  /** The raw PIN comes back exactly once — it is never retrievable again. */
  issuePin: (
    uid: string,
    input: { length: 4 | 6; ttlMinutes: number; notifyUser: boolean }
  ) =>
    request<IssuedPin>(`/admin/users/${uid}/pins`, {
      method: "POST",
      body: input,
    }),

  pins: (uid?: string) =>
    request<{ pins: AdminPin[] }>("/admin/pins", {
      query: uid ? { uid } : {},
    }),

  revokePin: (id: string) =>
    request<void>(`/admin/pins/${id}`, { method: "DELETE" }),

  paymentMethods: () => request<PaymentMethodConfig>("/admin/payment-methods"),

  saveBank: (input: {
    bankName: string
    accountName: string
    accountNumber: string
    routingNumber?: string
    swiftCode?: string
    isActive: boolean
  }) =>
    request<unknown>("/admin/payment-methods/bank", {
      method: "PUT",
      body: input,
    }),

  saveCryptoWallet: (input: {
    currency: string
    label: string
    walletAddress: string
    network: string
    isActive: boolean
  }) =>
    request<unknown>("/admin/payment-methods/crypto", {
      method: "PUT",
      body: input,
    }),

  deleteCryptoWallet: (id: string) =>
    request<void>(`/admin/payment-methods/crypto/${id}`, { method: "DELETE" }),

  saveDigitalWallet: (input: {
    provider: string
    handle: string
    instructions?: string
    isActive: boolean
  }) =>
    request<unknown>("/admin/payment-methods/wallets", {
      method: "PUT",
      body: input,
    }),

  deleteDigitalWallet: (id: string) =>
    request<void>(`/admin/payment-methods/wallets/${id}`, { method: "DELETE" }),

  auditLogs: (params: { page?: number; limit?: number } = {}) =>
    request<Paginated<AuditLogEntry>>("/admin/audit-logs", { query: params }),
}

export const health = () =>
  request<{ status: string; database: boolean }>("/health")
