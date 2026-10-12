-- Activity & follow-up overhaul, release 1 (expand).
--
-- Additive only, so the backend deployed today keeps working after this runs
-- and master can still be rolled back onto it: every new column is nullable or
-- has a default, nothing is renamed or dropped, and no existing column's value
-- changes. Only the NEW columns are filled for existing rows. Normalising
-- existing values (e.g. scheduledTime) ships with the release-2 data migration;
-- NOT NULL / drops ship with the release-3 contract migration.
--
-- The timezone written below must equal APP_TIMEZONE.

-- Guards ---------------------------------------------------------------------
-- Refuse to run on data this migration does not understand. The API has only
-- ever stored scheduledDate as UTC midnight ("YYYY-MM-DD") and scheduledTime as
-- "HH:mm". Anything else needs a person to look at it, not a guess; raising here
-- rolls the whole migration back.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "FollowUp"
    WHERE "scheduledDate" <> date_trunc('day', "scheduledDate")
  ) THEN
    RAISE EXCEPTION 'FollowUp.scheduledDate has values that are not at UTC midnight; inspect them before migrating';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "FollowUp"
    WHERE "scheduledTime" IS NOT NULL
      AND "scheduledTime" !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  ) THEN
    RAISE EXCEPTION 'FollowUp.scheduledTime has values that are not HH:mm; inspect them before migrating';
  END IF;
END $$;

-- FollowUp -------------------------------------------------------------------
ALTER TABLE "FollowUp" ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "statusReason" TEXT;

-- dueAt is the calendar date + wall-clock time read in Asia/Kolkata, stored as
-- UTC like every other timestamp column. A follow-up saved without a time is
-- due at 09:00: the time the reminder job has always assumed, so the
-- notification dedupe keys of those rows do not change.
UPDATE "FollowUp"
SET "dueAt" = (("scheduledDate"::date + COALESCE("scheduledTime", '09:00')::time)
                 AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'UTC',
    "statusReason" = "missedReason";

CREATE INDEX "FollowUp_assignedToId_status_dueAt_idx" ON "FollowUp"("assignedToId", "status", "dueAt");

CREATE INDEX "FollowUp_organizationId_status_dueAt_idx" ON "FollowUp"("organizationId", "status", "dueAt");

CREATE INDEX "FollowUp_dueAt_idx" ON "FollowUp"("dueAt");

-- ProspectActivity -----------------------------------------------------------
ALTER TABLE "ProspectActivity" ADD COLUMN     "clientRequestId" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "followUpId" TEXT,
ADD COLUMN     "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "outcome" "FollowUpOutcome",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedById" TEXT;

-- For existing rows createdAt is the best record of when the activity happened:
-- the old dialogs wrote the chosen time into createdAt (the prospect dialog
-- always sent "now"). The real logging time was never kept, so these rows will
-- not show as "logged late".
UPDATE "ProspectActivity" SET "occurredAt" = "createdAt", "updatedAt" = "createdAt";

CREATE INDEX "ProspectActivity_prospectId_occurredAt_idx" ON "ProspectActivity"("prospectId", "occurredAt" DESC);

CREATE INDEX "ProspectActivity_followUpId_idx" ON "ProspectActivity"("followUpId");

CREATE UNIQUE INDEX "ProspectActivity_prospectId_clientRequestId_key" ON "ProspectActivity"("prospectId", "clientRequestId");

ALTER TABLE "ProspectActivity" ADD CONSTRAINT "ProspectActivity_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "FollowUp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProspectActivity" ADD CONSTRAINT "ProspectActivity_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProspectActivity" ADD CONSTRAINT "ProspectActivity_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- LeadActivity ---------------------------------------------------------------
ALTER TABLE "LeadActivity" ADD COLUMN     "clientRequestId" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedById" TEXT;

-- The lead dialog wrote the chosen date and time into createdAt.
UPDATE "LeadActivity" SET "occurredAt" = "createdAt", "updatedAt" = "createdAt";

CREATE INDEX "LeadActivity_leadId_occurredAt_idx" ON "LeadActivity"("leadId", "occurredAt" DESC);

CREATE UNIQUE INDEX "LeadActivity_leadId_clientRequestId_key" ON "LeadActivity"("leadId", "clientRequestId");

ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Prospect -------------------------------------------------------------------
ALTER TABLE "Prospect" ADD COLUMN     "closedAt" TIMESTAMP(3);

-- A WON/LOST prospect closed when its latest stage change to that stage was
-- recorded. Without one (created directly in a closed stage), use updatedAt: a
-- closed prospect is read-only, so its last update is the close.
UPDATE "Prospect" p
SET "closedAt" = COALESCE(
  (
    SELECT MAX(a."createdAt")
    FROM "ProspectActivity" a
    WHERE a."prospectId" = p."id"
      AND a."type" = 'STAGE_CHANGE'
      AND a."metadata"->>'newStage' = p."stage"::text
  ),
  p."updatedAt"
)
WHERE p."stage" IN ('WON', 'LOST');

-- Post-conditions ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "FollowUp" WHERE "dueAt" IS NULL) THEN
    RAISE EXCEPTION 'FollowUp.dueAt backfill left rows without a due time';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Prospect"
    WHERE "stage" IN ('WON', 'LOST') AND "closedAt" IS NULL
  ) THEN
    RAISE EXCEPTION 'Prospect.closedAt backfill left closed prospects without a closing time';
  END IF;
END $$;
