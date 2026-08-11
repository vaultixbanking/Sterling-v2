/**
 * Response shapes for the Sterling Edge API.
 *
 * These mirror the serialisers in `server/src/`, which are the authority. Two
 * conventions carry over and matter everywhere:
 *
 *  - **Money is a decimal string**, e.g. `"1234.56"` — never a number. Format it
 *    with the helpers in `@/lib/format`; never put it through `parseFloat` for
 *    arithmetic.
 *  - **Dates are ISO strings**, because they crossed JSON to get here.
 */

/* ------------------------------------------------------------------ errors */

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "INVALID_CREDENTIALS"
  | "TOKEN_EXPIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INSUFFICIENT_FUNDS"
  | "INVALID_PIN"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR"
  /** Client-side only: the request never reached the server. */
  | "NETWORK_ERROR"

export interface ApiErrorDetail {
  /** Dotted path from the server, e.g. `"body.email"`. */
  path: string
  message: string
}

/* -------------------------------------------------------------- envelopes */

export interface PageMeta {
  page: number
  limit: number
  total: number
  pages: number
}

export interface Paginated<T> {
  items: T[]
  meta: PageMeta
}

/* ------------------------------------------------------------------- auth */

export type Role = "USER" | "ADMIN"
export type UserStatus = "ACTIVE" | "SUSPENDED"

export interface PublicUser {
  id: string
  uid: string
  email: string
  username: string
  fullName: string
  phone: string | null
  role: Role
  status: UserStatus
  createdAt: string
  lastLoginAt: string | null
}

export interface SessionPayload {
  user: PublicUser
  accessToken: string
}

export interface RegisterInput {
  fullName: string
  email: string
  username: string
  phone?: string
  password: string
  acceptedTerms: true
}

export interface LoginInput {
  identifier: string
  password: string
  /** `false` issues a session cookie that dies when the browser closes. */
  remember?: boolean
}

/* -------------------------------------------------------------- portfolio */

export interface HoldingSummary {
  id: string
  name: string
  symbol: string
  /** Fractional units, up to 8 decimal places. */
  units: string
  valueUsd: string
  createdAt?: string
}

export interface PortfolioSummary {
  balance: string
  available: string
  reserved: string
  investedCapital: string
  profitEarned: string
  todayProfit: string
  yesterdayProfit: string
  weekProfit: string
  totalReturnPercent: string
  holdingsValue: string
  holdings: HoldingSummary[]
}

export type PerformancePeriod = "7d" | "1m" | "3m" | "1y" | "all"

export interface PerformancePoint {
  /** `YYYY-MM-DD`, bucketed in UTC. */
  date: string
  value: string
  change: string
}

export interface PerformanceSeries {
  period: PerformancePeriod
  points: PerformancePoint[]
}

/* ----------------------------------------------------------- transactions */

export type TxType = "CREDIT" | "DEBIT"
export type TxStatus = "PENDING" | "COMPLETED" | "REJECTED" | "CANCELLED"
export type TxCategory =
  | "DEPOSIT"
  | "PROFIT"
  | "HOLDING"
  | "WITHDRAWAL"
  | "ADJUSTMENT"
  | "PLAN_PAYOUT"

export interface Transaction {
  id: string
  type: TxType
  category: TxCategory
  amount: string
  status: TxStatus
  description: string | null
  metadata: unknown
  createdAt: string
}

/* --------------------------------------------------------------- deposits */

export type DepositMethod =
  | "BANK_TRANSFER"
  | "CRYPTO"
  | "DIGITAL_WALLET"
  | "CARD"

export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"

export interface BankAccountDetails {
  bankName: string
  accountName: string
  accountNumber: string
  routingNumber: string | null
  swiftCode: string | null
}

export interface CryptoWalletDetails {
  currency: string
  label: string
  walletAddress: string
  network: string
}

export interface DigitalWalletDetails {
  provider: string
  handle: string
  instructions: string | null
}

export interface DepositMethods {
  bank: BankAccountDetails | null
  crypto: CryptoWalletDetails[]
  digitalWallets: DigitalWalletDetails[]
  minimumDeposit: string
  supportEmail: string
}

export interface DepositRequest {
  id: string
  amount: string
  method: DepositMethod
  reference: string | null
  status: RequestStatus
  reviewNote: string | null
  hasProof: boolean
  createdAt: string
}

/* ------------------------------------------------------------ withdrawals */

export type WithdrawalMethod = "CRYPTO" | "BANK"

export interface CryptoDestination {
  walletAddress: string
  network: string
  currency: string | null
}

export interface BankDestination {
  bankName: string
  accountName: string
  accountNumber: string
  routingNumber: string | null
  swiftCode: string | null
}

export type WithdrawalDestination = CryptoDestination | BankDestination

export interface WithdrawalRequest {
  id: string
  amount: string
  fee: string
  method: WithdrawalMethod
  status: RequestStatus
  destination: WithdrawalDestination
  reviewNote: string | null
  createdAt: string
}

/**
 * The fee and floor the server enforces, sent with the withdrawal list so the
 * client's preview is always the server's own arithmetic rather than a second
 * copy of the rule that can fall out of step.
 */
export interface WithdrawalLimits {
  /** Percent as a decimal string, e.g. `"5.00"`. */
  feePercent: string
  /** Minimum withdrawal in USD, e.g. `"10.00"`. */
  minimum: string
}

export interface CreateWithdrawalInput {
  amount: number
  method: WithdrawalMethod
  pin: string
  walletAddress?: string
  network?: string
  currency?: string
  bankName?: string
  accountName?: string
  accountNumber?: string
  routingNumber?: string
  swiftCode?: string
}

/* ------------------------------------------------------------------ plans */

export interface Plan {
  id: string
  slug: string
  name: string
  /** Percent per day, e.g. `"1.20"`. */
  dailyReturnPercent: string
  durationDays: number
  minDeposit: string
  maxDeposit: string | null
  referralBonusPercent: number
  description: string | null
  features: string[]
  isPopular: boolean
}

export type SubscriptionStatus = "ACTIVE" | "COMPLETED" | "CANCELLED"

export interface Subscription {
  id: string
  plan: Plan
  principal: string
  totalAccrued: string
  status: SubscriptionStatus
  startedAt: string
  endsAt: string
}

/* ------------------------------------------------------------------ admin */

export interface AdminStats {
  users: { total: number; active: number }
  queues: { pendingDeposits: number; pendingWithdrawals: number }
  ledger: {
    totalCredited: string
    totalDebited: string
    /** Platform-wide liability to clients. */
    clientLiability: string
    reserved: string
  }
}

export interface AdminUserListItem {
  id: string
  uid: string
  email: string
  username: string
  fullName: string
  phone: string | null
  role: Role
  status: UserStatus
  lastLoginAt: string | null
  createdAt: string
  balance: string
  available: string
}

export interface AdminUserDetail {
  user: {
    id: string
    uid: string
    email: string
    username: string
    fullName: string
    phone: string | null
    role: Role
    status: UserStatus
    lastLoginAt: string | null
    lastLoginIp: string | null
    createdAt: string
  }
  balance: { balance: string; available: string; reserved: string }
  holdings: HoldingSummary[]
  subscriptions: Array<{
    id: string
    planName: string
    principal: string
    totalAccrued: string
    status: SubscriptionStatus
    endsAt: string
  }>
  recentTransactions: Array<{
    id: string
    type: TxType
    category: TxCategory
    amount: string
    status: TxStatus
    description: string | null
    createdAt: string
  }>
}

/** The user summary embedded in admin queue rows. */
export interface QueueUser {
  uid: string
  email: string
  fullName: string
}

export interface AdminDepositRow {
  id: string
  user: QueueUser
  amount: string
  method: DepositMethod
  reference: string | null
  status: RequestStatus
  hasProof: boolean
  createdAt: string
}

export interface AdminWithdrawalRow {
  id: string
  user: QueueUser
  amount: string
  fee: string
  method: WithdrawalMethod
  destination: WithdrawalDestination
  status: RequestStatus
  createdAt: string
}

export type PinStatus = "ACTIVE" | "USED" | "EXPIRED" | "REVOKED"

export interface AdminPin {
  id: string
  user: { uid: string; fullName: string; email: string } | null
  status: PinStatus
  expiresAt: string
  usedAt: string | null
  createdAt: string
}

/** Returned exactly once, to the issuing admin. */
export interface IssuedPin {
  pin: string
  expiresAt: string
  user: { uid: string; fullName: string }
}

export interface BankConfig extends BankAccountDetails {
  id: string
  isActive: boolean
}

export interface CryptoConfig extends CryptoWalletDetails {
  id: string
  isActive: boolean
}

export interface WalletConfig extends DigitalWalletDetails {
  id: string
  isActive: boolean
}

export interface PaymentMethodConfig {
  bank: BankConfig | null
  crypto: CryptoConfig[]
  digitalWallets: WalletConfig[]
}

export interface AuditLogEntry {
  id: string
  actorId: string | null
  actor: { username: string; email: string } | null
  action: string
  targetType: string | null
  targetId: string | null
  before: unknown
  after: unknown
  ip: string | null
  createdAt: string
}
