-- `citext` is a standard contrib extension; the ALTER below cannot run without
-- it, so the migration creates it rather than assuming the target database
-- already has it. Idempotent, and a no-op where it is already installed.
CREATE EXTENSION IF NOT EXISTS citext;

-- Makes the existing unique constraint case-insensitive. Postgres rebuilds the
-- index as part of this, so it FAILS LOUDLY if two rows differ only by case —
-- which is the behaviour we want: it can never silently merge two accounts.
-- AlterTable
ALTER TABLE "users" ALTER COLUMN "username" SET DATA TYPE CITEXT;
