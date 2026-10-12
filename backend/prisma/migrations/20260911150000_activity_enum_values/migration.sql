-- Activity & follow-up overhaul, release 1 (expand): new activity types.
--
-- Alone in its own migration on purpose. applyPendingMigrations.ts runs each
-- migration inside a transaction, and Postgres cannot use an enum value in the
-- transaction that added it; the release-2 data migration uses these values.
--
-- Additive only. No existing row uses them, so the backend that is currently
-- deployed keeps working after this runs.
ALTER TYPE "ProspectActivityType" ADD VALUE IF NOT EXISTS 'SITE_VISIT';
ALTER TYPE "ProspectActivityType" ADD VALUE IF NOT EXISTS 'FOLLOW_UP_RESCHEDULED';
ALTER TYPE "ProspectActivityType" ADD VALUE IF NOT EXISTS 'FOLLOW_UP_CANCELLED';
