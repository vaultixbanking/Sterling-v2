# Sterling Edge Trade — API

REST API for the Sterling Edge Trade platform. Node 22+, TypeScript, Express 5,
PostgreSQL via Prisma.

Replaces the SwiftEdge backend (a single 2,338-line `server.js`). Same
behaviour, layered properly, with the security and correctness defects fixed —
see [What changed](#what-changed-from-swiftedge).

---

## Quick start

```bash
cd server
cp .env.example .env          # fill in DATABASE_URL, JWT secrets, Resend key
npm install
npx prisma migrate deploy     # or `npm run prisma:migrate` in development
npm run seed                  # admin account + the 4 investment plans
npm run dev                   # http://localhost:4000
```

Verify it is up:

```bash
curl http://localhost:4000/api/v1/health
# {"success":true,"data":{"status":"healthy","database":true}}
```

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Watch mode via tsx |
| `npm run build` | Generate Prisma client + compile to `dist/` |
| `npm start` | Run the compiled server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run prisma:migrate` | Create + apply a migration |
| `npm run prisma:studio` | Browse the database |
| `npm run seed` | Seed admin + plans (idempotent) |

---

## Architecture

```
src/
├── config/      env.ts (Zod-validated, fails fast), constants.ts
├── lib/         prisma · logger · errors · money · crypto · http · storage
├── middleware/  authenticate · authorize · validate · rate-limit · error-handler · upload
├── modules/     one folder per domain: routes + controller + service + schema
├── services/    ledger · audit · email (cross-cutting business logic)
├── jobs/        cron: expire-pins · accrue-plan-returns · keep-alive
├── app.ts       Express assembly
└── index.ts     bootstrap
```

**The layering rule:** controllers handle HTTP only — parse the request, call a
service, shape the response. Services hold business logic and never touch
`req`/`res`. Only services talk to Prisma. Keeping to this is what makes the
codebase navigable.

### The ledger

`src/services/ledger.service.ts` is the single source of truth for money.

```
balance   = Σ(COMPLETED CREDIT) − Σ(COMPLETED DEBIT)
available = balance − Σ(PENDING DEBIT)
```

There is **no** `balance` column on `User`. Every figure is derived from the
`Transaction` table on read. That is deliberate: SwiftEdge stored a
`totalBalance`, recomputed it as `holdings + profits`, and mutated it directly
on withdrawal approval — so the next portfolio load restored the withdrawn
money. With nothing stored, that bug cannot be written.

Pending debits are subtracted from `available`, so requesting a withdrawal
reserves the funds immediately.

`debit()` takes a `SELECT … FOR UPDATE` row lock on the user and re-checks the
balance **inside** the same transaction that inserts the row, which is what
makes concurrent withdrawals safe.

**Money is `Decimal(18,2)` everywhere — never a JS float.**

---

## API

Base path `/api/v1`. Every response uses one envelope:

```jsonc
{ "success": true,  "data": { } }
{ "success": false, "error": { "code": "INSUFFICIENT_FUNDS", "message": "…", "details": [] } }
```

Error codes: `VALIDATION_ERROR` `UNAUTHENTICATED` `INVALID_CREDENTIALS`
`TOKEN_EXPIRED` `FORBIDDEN` `NOT_FOUND` `CONFLICT` `INSUFFICIENT_FUNDS`
`INVALID_PIN` `RATE_LIMITED` `PAYLOAD_TOO_LARGE` `UNSUPPORTED_MEDIA_TYPE`
`SERVICE_UNAVAILABLE` `INTERNAL_ERROR`

### Auth

Access token in `Authorization: Bearer <token>` (15 min default). Refresh token
in an httpOnly `se_refresh` cookie (30 days), rotated on every use. Requests
that touch the cookie need `credentials: "include"`.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | — | Rate limited 10/15min |
| POST | `/auth/login` | — | Accepts email **or** username as `identifier` |
| POST | `/auth/refresh` | cookie | Rotates the refresh token |
| POST | `/auth/logout` | cookie | Revokes this session |
| POST | `/auth/logout-all` | token | Revokes every session |
| POST | `/auth/forgot-password` | — | Always 200, never reveals whether the address exists |
| POST | `/auth/reset-password` | — | Token is single-use; signs out all devices |
| GET | `/auth/me` | token | Current user |

### User

| Method | Path | Notes |
|---|---|---|
| GET / PATCH | `/users/me` | Profile |
| POST | `/users/me/change-password` | Signs out all devices |
| GET | `/portfolio` | Balances + holdings + derived figures |
| GET | `/portfolio/performance?period=7d\|1m\|3m\|1y\|all` | UTC-bucketed, zero-filled series |
| GET | `/transactions?page&limit&type&status&category` | Paginated ledger |
| GET | `/holdings` | Active positions |
| GET | `/deposits/methods` | Where to send money |
| POST / GET | `/deposits` | Submit request (multipart, `proof` file) / list own |
| POST / GET | `/withdrawals` | Requires `pin`; reserves funds |
| POST | `/withdrawals/:id/cancel` | While still pending |
| GET | `/plans` | **Public** |
| GET / POST | `/subscriptions` | Subscribe to a plan |
| POST | `/subscriptions/:id/cancel` | Returns the principal |

### Admin — `requireRole('ADMIN')` on every route

`/admin/stats` · `/admin/users` (paginated + search) · `/admin/users/:uid` ·
`PATCH /admin/users/:uid/status` · `POST /admin/users/:uid/adjustments`
(credit **or** debit) · holdings CRUD · `/admin/deposits` +
`/admin/deposits/:id/process` + `/admin/deposits/:id/proof` (signed URL) ·
`/admin/withdrawals` + `/admin/withdrawals/:id/process` ·
`POST /admin/users/:uid/pins` · `GET|DELETE /admin/pins` ·
`/admin/payment-methods/{bank,crypto,wallets}` · `/admin/audit-logs`

### Withdrawal flow

1. Admin issues a PIN: `POST /admin/users/:uid/pins` → raw PIN returned **once**.
2. User submits `POST /withdrawals` with the PIN in the body. In one database
   transaction the API verifies the PIN (right owner, active, unexpired), marks
   it `USED`, re-checks the available balance, and inserts a `PENDING` debit
   that reserves the funds.
3. Admin approves (`COMPLETED`, money stays gone) or rejects (`REJECTED`,
   reservation released). Both send email and write an audit log entry.

---

## Environment

See `.env.example`. Startup validates everything and exits with a readable
message if anything is missing.

Notes:

- `DATABASE_URL` should be Supabase's **pooled** connection (pgBouncer, port
  6543). `DIRECT_URL` must be the **direct** connection (5432) — migrations
  fail through a transaction pooler.
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must differ. Generate with
  `openssl rand -base64 48`.
- `SUPABASE_*` and `RESEND_API_KEY` are optional in development (uploads and
  email degrade to no-ops) and **required** in production.
- Supabase's free tier pauses a project after 7 days idle; the `keep-alive`
  cron pings it every 3 days.

---

## Testing

```bash
npm test                                            # logic tests only
TEST_DATABASE_URL="postgresql://…" npm test         # + ledger and PIN suites
```

The ledger and PIN suites need a real Postgres — they exercise row locks,
isolation levels and concurrent transactions, which no in-memory fake
reproduces. Use a scratch database:

```bash
createdb sterling_test
DIRECT_URL="postgresql://$USER@localhost:5432/sterling_test" \
DATABASE_URL="$DIRECT_URL" npx prisma migrate deploy
TEST_DATABASE_URL="postgresql://$USER@localhost:5432/sterling_test" npm test
```

Each test pins a specific SwiftEdge defect so it cannot return — notably that
an approved withdrawal stays deducted across repeated balance reads, and that
two concurrent withdrawals for 90% of a balance produce exactly one success.

---

## What changed from SwiftEdge

### Security

| SwiftEdge | Now |
|---|---|
| Every `/admin/*` route behind the **user** middleware; `authenticateAdmin` never checked `role`. Any customer could credit themselves, rewrite deposit wallet addresses, mint PINs, approve their own withdrawals. | `authenticate` + `requireRole('ADMIN')`, with `role` carried in the token and asserted. |
| PINs global (no `userId`), infinitely reusable, `Math.random()`, verified on an unauthenticated route, and **never checked on withdraw** (`pinVerified: true` hardcoded). | Bound to one user, single-use, `crypto.randomInt`, bcrypt-hashed, rate-limited, enforced inside `POST /withdrawals`. |
| `POST /debug-email` — unauthenticated open mail relay. | Deleted. |
| No rate limiting anywhere. | `express-rate-limit` on auth, password reset and PIN paths. |
| Reset tokens stored in plaintext. | SHA-256 at rest, single-use, expiring. |
| `'Account not found'` vs `'Incorrect password'` — free user enumeration. | Byte-identical `INVALID_CREDENTIALS` for both. |
| Raw JWTs, raw PINs and full password hashes written to logs. | `pino` with redaction on tokens, PINs, passwords and account numbers. |
| Unauthenticated `/api/deposit-details` exposing bank details. | Authenticated `/deposits/methods`. |
| One JWT, no logout, no revocation. | Access + rotating refresh, real logout, revoke-all on credential change. |
| No `helmet`, no body size limit, no error handler (stack traces to clients). | All present; internal errors never leak in production. |

### Correctness

| SwiftEdge | Now |
|---|---|
| Approved withdrawals refunded themselves on the next portfolio load. | Balance derived from the ledger; nothing to overwrite. |
| No reservation — ten $900 withdrawals all passed on a $1,000 balance. | Pending debits reserved; row lock + in-transaction re-check. |
| Two non-atomic saves on approval. | One database transaction. |
| Profits capped at `min: 0` — a loss was impossible to record. | Adjustments go both directions. |
| Date buckets in server-local time. | UTC throughout. |
| Performance chart omitted gap days and started from 0. | Zero-filled, uniform, starting from opening balance. |
| Zero indexes on the hot paths. | Compound indexes on the balance aggregate and every listing query. |
| No validation library; `add-holding` accepted a negative or string value. | Zod at every boundary. |
| Six different response shapes, including plain text and bare arrays. | One envelope. |
| Holdings append-only; no edit, no delete. | Full CRUD with archival + audit. |
| No admin user list — one UID lookup at a time. | Paginated list with search. |
| No audit trail. | Every admin mutation logged. |

### Removed

`store.js` (dead — no imports, would throw on the first line), `cleanup.js`
(hardcoded localhost URL; requiring it booted the whole production server),
`adminOnly`/`ADMIN_UIDS` (never mounted, would always fail), the `node-fetch`
shim (required but not installed), `GET /reset-password/:token` (redirected in
a way the POST handler could not consume), static frontend serving (Next.js
owns that), and `getAssetType`/`getAssetIcon` (FontAwesome class names returned
from an API).

---

## Deployment

```bash
npm ci
npm run build
npx prisma migrate deploy
npm start
```

Set `NODE_ENV=production`, a real `CORS_ORIGINS`, and `COOKIE_DOMAIN` if the
API and frontend share a parent domain. The app trusts one proxy hop
(`trust proxy: 1`) for correct client IPs behind Render/Vercel/nginx.

`SIGTERM`/`SIGINT` drain connections and disconnect Prisma, with a 10-second
hard timeout.
