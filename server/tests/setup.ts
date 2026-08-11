/**
 * Test environment defaults.
 *
 * The ledger and PIN suites need a real Postgres because they exercise row
 * locks, isolation levels and concurrent transactions — behaviour no in-memory
 * fake reproduces. Point TEST_DATABASE_URL at a scratch database to run them:
 *
 *   TEST_DATABASE_URL="postgresql://…" npm test
 *
 * Without it those suites skip and the pure-logic ones still run.
 */
process.env.NODE_ENV = "test"
process.env.API_URL ??= "http://localhost:4000"
process.env.APP_URL ??= "http://localhost:3000"
process.env.CORS_ORIGINS ??= "http://localhost:3000"
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-at-least-32-characters!!"
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-at-least-32-characters!"

const testDatabaseUrl = process.env.TEST_DATABASE_URL

// A placeholder keeps env validation (and therefore module imports) happy when
// no test database is configured. Nothing connects to it — the suites that
// would are skipped.
process.env.DATABASE_URL =
  testDatabaseUrl ?? "postgresql://placeholder:placeholder@127.0.0.1:5432/none"
