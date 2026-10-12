-- Activity & follow-up overhaul, release 3 (contract). STAGED: see ../README.md.
-- Do not move this into prisma/migrations until release 2 has been stable.
--
-- Removes what the new code no longer uses and enforces what it guarantees.
-- Contractive: after this, a backend build older than release 2 cannot run.

-- Catch up anything written since release 2 (idempotent).
UPDATE "FollowUp"
SET "dueAt" = (("scheduledDate"::date + COALESCE("scheduledTime", '09:00')::time)
                 AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'UTC'
WHERE "dueAt" IS NULL;

UPDATE "FollowUp" SET "scheduledTime" = '09:00' WHERE "scheduledTime" IS NULL;

UPDATE "FollowUp"
SET "statusReason" = "missedReason"
WHERE "statusReason" IS NULL AND "missedReason" IS NOT NULL;

ALTER TABLE "FollowUp"
  ALTER COLUMN "scheduledTime" SET NOT NULL,
  ALTER COLUMN "dueAt" SET NOT NULL,
  DROP COLUMN "missedReason";

DROP INDEX IF EXISTS "FollowUp_assignedToId_status_scheduledDate_idx";
DROP INDEX IF EXISTS "FollowUp_organizationId_status_scheduledDate_idx";
DROP INDEX IF EXISTS "FollowUp_scheduledDate_idx";

-- An undo copy in migration_backup that still uses the enum would block the
-- DROP TYPE; keep its data as text instead.
DO $$
DECLARE
  col record;
BEGIN
  FOR col IN
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'migration_backup' AND udt_name = 'FollowUpHealth'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I TYPE text USING %I::text',
                   col.table_schema, col.table_name, col.column_name, col.column_name);
  END LOOP;
END $$;

ALTER TABLE "ProspectActivity" DROP COLUMN "followUpHealth";
DROP TYPE IF EXISTS "FollowUpHealth";

DROP INDEX IF EXISTS "ProspectActivity_prospectId_createdAt_idx";
DROP INDEX IF EXISTS "LeadActivity_leadId_createdAt_idx";
