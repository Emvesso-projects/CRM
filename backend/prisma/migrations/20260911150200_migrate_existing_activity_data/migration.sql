-- Activity & follow-up overhaul, release 2: move existing records into the new
-- model so old data looks and behaves exactly like new data.
--
-- Data only. Every step skips rows it has already migrated, so running it again
-- changes nothing. The invariants at the end roll the whole migration back if
-- the result is not consistent. An undo copy of the touched tables is kept in
-- the migration_backup schema (which Prisma does not manage) until it is
-- dropped after the release is signed off.
--
-- The timezone written below must equal APP_TIMEZONE. Timestamps written here
-- use now() AT TIME ZONE 'UTC', which is how the application stores them.

-- 0. Undo copy -----------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS "migration_backup";

DO $$
DECLARE
  col record;
BEGIN
  IF to_regclass('"migration_backup"."FollowUp_20260911"') IS NULL THEN
    CREATE TABLE "migration_backup"."FollowUp_20260911" AS TABLE "FollowUp";
    CREATE TABLE "migration_backup"."ProspectActivity_20260911" AS TABLE "ProspectActivity";
    CREATE TABLE "migration_backup"."Prospect_20260911" AS TABLE "Prospect";
    CREATE TABLE "migration_backup"."LeadActivity_20260911" AS TABLE "LeadActivity";

    -- Enum columns are kept as text, so the copy never blocks a later change to
    -- those types (release 3 drops "FollowUpHealth"). Restore with ::"EnumName".
    FOR col IN
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'migration_backup'
        AND table_name IN ('FollowUp_20260911', 'ProspectActivity_20260911',
                           'Prospect_20260911', 'LeadActivity_20260911')
        AND data_type = 'USER-DEFINED'
    LOOP
      EXECUTE format('ALTER TABLE "migration_backup".%I ALTER COLUMN %I TYPE text USING %I::text',
                     col.table_name, col.column_name, col.column_name);
    END LOOP;
  END IF;
END $$;

-- 1. Catch up rows an older build wrote after release 1, and normalise times ---
UPDATE "FollowUp"
SET "dueAt" = (("scheduledDate"::date + COALESCE("scheduledTime", '09:00')::time)
                 AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'UTC'
WHERE "dueAt" IS NULL;

UPDATE "FollowUp"
SET "statusReason" = "missedReason"
WHERE "statusReason" IS NULL AND "missedReason" IS NOT NULL;

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
WHERE p."stage" IN ('WON', 'LOST') AND p."closedAt" IS NULL;

-- A follow-up saved without a time is due at 09:00; its dueAt already says so.
UPDATE "FollowUp" SET "scheduledTime" = '09:00' WHERE "scheduledTime" IS NULL;

-- A completed follow-up always has a completion time.
UPDATE "FollowUp"
SET "completedAt" = "updatedAt"
WHERE "status" = 'COMPLETED' AND "completedAt" IS NULL;

-- 2. Pending follow-ups nobody can work on -------------------------------------
WITH stale AS (
  UPDATE "FollowUp" f
  SET "status" = 'CANCELLED',
      "statusReason" = 'Closed automatically: the prospect was already won, lost or deleted',
      "updatedAt" = now() AT TIME ZONE 'UTC'
  FROM "Prospect" p
  WHERE p."id" = f."prospectId"
    AND f."status" = 'PENDING'
    AND (p."stage" IN ('WON', 'LOST') OR p."deletedAt" IS NOT NULL)
  RETURNING f."id", f."prospectId"
)
INSERT INTO "ProspectActivity"
  ("id", "prospectId", "type", "title", "summary", "followUpId", "metadata",
   "occurredAt", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."prospectId", 'FOLLOW_UP_CANCELLED', 'Follow-up cancelled',
       'Cancelled automatically: the prospect was already won, lost or deleted', s."id",
       jsonb_build_object('migratedFrom', 'STALE_PENDING'),
       now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'
FROM stale s;

-- 3. Pending follow-ups without an assignee get the prospect's owner, so
--    someone receives the reminder.
UPDATE "FollowUp" f
SET "assignedToId" = p."assignedToId"
FROM "Prospect" p
WHERE p."id" = f."prospectId"
  AND f."status" = 'PENDING'
  AND f."assignedToId" IS NULL
  AND p."assignedToId" IS NOT NULL;

-- 4. Link follow-up events to their follow-up ------------------------------------
-- The previous code wrote each event in the same transaction as the follow-up
-- change, and a prospect has at most one pending follow-up at a time, so the
-- follow-up changed within 10 seconds of the event is the one it describes.
-- Matching is one-to-one; anything ambiguous or unmatched stays unlinked.

-- 4a. "scheduled" events -> the follow-up created in the same transaction
WITH candidates AS (
  SELECT a."id" AS activity_id, f."id" AS follow_up_id,
         abs(extract(epoch FROM (a."createdAt" - f."createdAt"))) AS gap
  FROM "ProspectActivity" a
  JOIN "FollowUp" f ON f."prospectId" = a."prospectId"
  WHERE a."followUpId" IS NULL
    AND a."type" = 'FOLLOW_UP_SET'
    AND a."title" IN ('Follow-up scheduled', 'Next follow-up scheduled')
    AND abs(extract(epoch FROM (a."createdAt" - f."createdAt"))) <= 10
    AND NOT EXISTS (
      SELECT 1 FROM "ProspectActivity" x
      WHERE x."followUpId" = f."id"
        AND x."type" = 'FOLLOW_UP_SET'
        AND x."title" IN ('Follow-up scheduled', 'Next follow-up scheduled')
    )
), ranked AS (
  SELECT activity_id, follow_up_id,
         row_number() OVER (PARTITION BY activity_id ORDER BY gap, follow_up_id) AS by_activity,
         row_number() OVER (PARTITION BY follow_up_id ORDER BY gap, activity_id) AS by_follow_up
  FROM candidates
)
UPDATE "ProspectActivity" a
SET "followUpId" = r.follow_up_id
FROM ranked r
WHERE a."id" = r.activity_id AND r.by_activity = 1 AND r.by_follow_up = 1;

-- 4b. "completed" events -> the follow-up completed in the same transaction
WITH candidates AS (
  SELECT a."id" AS activity_id, f."id" AS follow_up_id,
         abs(extract(epoch FROM (a."createdAt" - f."completedAt"))) AS gap
  FROM "ProspectActivity" a
  JOIN "FollowUp" f ON f."prospectId" = a."prospectId"
  WHERE a."followUpId" IS NULL
    AND a."type" = 'FOLLOW_UP_SET'
    AND a."title" = 'Follow-up completed'
    AND f."status" = 'COMPLETED'
    AND abs(extract(epoch FROM (a."createdAt" - f."completedAt"))) <= 10
    AND NOT EXISTS (
      SELECT 1 FROM "ProspectActivity" x
      WHERE x."followUpId" = f."id"
        AND (x."title" = 'Follow-up completed'
             OR x."type" IN ('CALL', 'IN_PERSON_MEETING', 'VIRTUAL_MEETING', 'EMAIL',
                             'WHATSAPP', 'TEXT', 'SITE_VISIT', 'NOTE', 'MEETING'))
    )
), ranked AS (
  SELECT activity_id, follow_up_id,
         row_number() OVER (PARTITION BY activity_id ORDER BY gap, follow_up_id) AS by_activity,
         row_number() OVER (PARTITION BY follow_up_id ORDER BY gap, activity_id) AS by_follow_up
  FROM candidates
)
UPDATE "ProspectActivity" a
SET "followUpId" = r.follow_up_id
FROM ranked r
WHERE a."id" = r.activity_id AND r.by_activity = 1 AND r.by_follow_up = 1;

-- 4c. "cancelled" and "missed" events -> the follow-up closed in the same transaction
WITH candidates AS (
  SELECT a."id" AS activity_id, f."id" AS follow_up_id,
         abs(extract(epoch FROM (a."createdAt" - f."updatedAt"))) AS gap
  FROM "ProspectActivity" a
  JOIN "FollowUp" f ON f."prospectId" = a."prospectId"
  WHERE a."followUpId" IS NULL
    AND a."type" = 'FOLLOW_UP_SET'
    AND (
      (a."title" = 'Follow-up cancelled' AND f."status" = 'CANCELLED')
      OR (a."title" = 'Follow-up missed' AND f."status" = 'MISSED')
    )
    AND abs(extract(epoch FROM (a."createdAt" - f."updatedAt"))) <= 10
), ranked AS (
  SELECT activity_id, follow_up_id,
         row_number() OVER (PARTITION BY activity_id ORDER BY gap, follow_up_id) AS by_activity,
         row_number() OVER (PARTITION BY follow_up_id ORDER BY gap, activity_id) AS by_follow_up
  FROM candidates
)
UPDATE "ProspectActivity" a
SET "followUpId" = r.follow_up_id
FROM ranked r
WHERE a."id" = r.activity_id AND r.by_activity = 1 AND r.by_follow_up = 1;

-- 4d. "rescheduled" events -> the follow-up whose successor was created in the same transaction
WITH candidates AS (
  SELECT a."id" AS activity_id, f."id" AS follow_up_id,
         abs(extract(epoch FROM (a."createdAt" - successor."createdAt"))) AS gap
  FROM "ProspectActivity" a
  JOIN "FollowUp" f ON f."prospectId" = a."prospectId"
  JOIN "FollowUp" successor ON successor."id" = f."rescheduledToId"
  WHERE a."followUpId" IS NULL
    AND a."type" = 'FOLLOW_UP_SET'
    AND a."title" IN ('Follow-up rescheduled', 'Follow-up missed and rescheduled')
    AND f."status" = 'RESCHEDULED'
    AND abs(extract(epoch FROM (a."createdAt" - successor."createdAt"))) <= 10
), ranked AS (
  SELECT activity_id, follow_up_id,
         row_number() OVER (PARTITION BY activity_id ORDER BY gap, follow_up_id) AS by_activity,
         row_number() OVER (PARTITION BY follow_up_id ORDER BY gap, activity_id) AS by_follow_up
  FROM candidates
)
UPDATE "ProspectActivity" a
SET "followUpId" = r.follow_up_id
FROM ranked r
WHERE a."id" = r.activity_id AND r.by_activity = 1 AND r.by_follow_up = 1;

-- 4e. "updated" events (date changed in place) -> the follow-up pending at that moment
WITH candidates AS (
  SELECT a."id" AS activity_id, f."id" AS follow_up_id,
         extract(epoch FROM (a."createdAt" - f."createdAt")) AS age
  FROM "ProspectActivity" a
  JOIN "FollowUp" f ON f."prospectId" = a."prospectId"
  WHERE a."followUpId" IS NULL
    AND a."type" = 'FOLLOW_UP_SET'
    AND a."title" = 'Follow-up updated'
    AND f."createdAt" <= a."createdAt" + interval '10 seconds'
    AND (f."status" = 'PENDING'
         OR COALESCE(f."completedAt", f."updatedAt") >= a."createdAt" - interval '10 seconds')
), ranked AS (
  SELECT activity_id, follow_up_id,
         row_number() OVER (PARTITION BY activity_id ORDER BY age, follow_up_id) AS by_activity
  FROM candidates
)
UPDATE "ProspectActivity" a
SET "followUpId" = r.follow_up_id
FROM ranked r
WHERE a."id" = r.activity_id AND r.by_activity = 1;

-- 5. Give follow-up events their own types (titles stay as written) ----------------
UPDATE "ProspectActivity"
SET "type" = 'FOLLOW_UP_RESCHEDULED'
WHERE "type" = 'FOLLOW_UP_SET'
  AND "title" IN ('Follow-up rescheduled', 'Follow-up missed and rescheduled', 'Follow-up updated');

UPDATE "ProspectActivity"
SET "type" = 'FOLLOW_UP_CANCELLED'
WHERE "type" = 'FOLLOW_UP_SET'
  AND "title" IN ('Follow-up cancelled', 'Follow-up missed', 'Prospect deleted');

UPDATE "ProspectActivity" a
SET "metadata" = COALESCE(a."metadata", '{}'::jsonb) || jsonb_build_object('newFollowUpId', f."rescheduledToId")
FROM "FollowUp" f
WHERE a."followUpId" = f."id"
  AND a."type" = 'FOLLOW_UP_RESCHEDULED'
  AND f."rescheduledToId" IS NOT NULL
  AND NOT (COALESCE(a."metadata", '{}'::jsonb) ? 'newFollowUpId');

-- 6. Prospect "notes" ---------------------------------------------------------------
-- The prospect dialog's "Note" button saved type TEXT (title "Text Message").
UPDATE "ProspectActivity"
SET "type" = 'NOTE', "title" = 'Note'
WHERE "type" = 'TEXT'
  AND "title" = 'Text Message'
  AND NOT (COALESCE("metadata", '{}'::jsonb) ? 'migratedFrom');

-- 7. Every completed follow-up gets exactly one completing interaction ------------
-- The type chosen when completing was never saved, so the follow-up's scheduled
-- type is used, and recorded as such in metadata.

-- 7a. Turn the linked "Follow-up completed" event into that interaction.
UPDATE "ProspectActivity" a
SET "type" = f."type"::text::"ProspectActivityType",
    "title" = CASE f."type"::text
                WHEN 'CALL' THEN 'Call'
                WHEN 'IN_PERSON_MEETING' THEN 'In-person meeting'
                WHEN 'VIRTUAL_MEETING' THEN 'Virtual meeting'
                WHEN 'EMAIL' THEN 'Email'
                WHEN 'WHATSAPP' THEN 'WhatsApp'
                WHEN 'TEXT' THEN 'SMS / Text'
                WHEN 'SITE_VISIT' THEN 'Site visit'
                ELSE 'Meeting'
              END,
    "summary" = COALESCE(NULLIF(btrim(f."completionRemark"), ''), NULLIF(btrim(a."details"), ''), a."summary"),
    "details" = NULL,
    "outcome" = f."outcome",
    "occurredAt" = f."completedAt",
    "metadata" = COALESCE(a."metadata", '{}'::jsonb) || jsonb_build_object(
      'migratedFrom', 'FOLLOW_UP_COMPLETED_EVENT',
      'typeSource', 'scheduled_follow_up_type',
      'legacyTitle', a."title",
      'legacySummary', a."summary"
    )
FROM "FollowUp" f
WHERE a."followUpId" = f."id"
  AND a."type" = 'FOLLOW_UP_SET'
  AND a."title" = 'Follow-up completed'
  AND f."status" = 'COMPLETED';

-- 7b. Otherwise link the manual interaction the same person logged with the same
--     remark around the time of completing it (a two-step save).
WITH candidates AS (
  SELECT a."id" AS activity_id, f."id" AS follow_up_id,
         abs(extract(epoch FROM (a."createdAt" - f."completedAt"))) AS gap
  FROM "FollowUp" f
  JOIN "ProspectActivity" a ON a."prospectId" = f."prospectId"
  WHERE f."status" = 'COMPLETED'
    AND NULLIF(btrim(f."completionRemark"), '') IS NOT NULL
    AND a."followUpId" IS NULL
    AND a."deletedAt" IS NULL
    AND a."type" IN ('CALL', 'IN_PERSON_MEETING', 'VIRTUAL_MEETING', 'EMAIL',
                     'WHATSAPP', 'TEXT', 'SITE_VISIT', 'NOTE', 'MEETING')
    AND a."createdById" IS NOT DISTINCT FROM f."completedById"
    AND btrim(COALESCE(a."details", a."summary")) = btrim(f."completionRemark")
    AND abs(extract(epoch FROM (a."createdAt" - f."completedAt"))) <= 600
    AND NOT EXISTS (
      SELECT 1 FROM "ProspectActivity" x
      WHERE x."followUpId" = f."id"
        AND x."type" IN ('CALL', 'IN_PERSON_MEETING', 'VIRTUAL_MEETING', 'EMAIL',
                         'WHATSAPP', 'TEXT', 'SITE_VISIT', 'NOTE', 'MEETING')
    )
), ranked AS (
  SELECT activity_id, follow_up_id,
         row_number() OVER (PARTITION BY activity_id ORDER BY gap, follow_up_id) AS by_activity,
         row_number() OVER (PARTITION BY follow_up_id ORDER BY gap, activity_id) AS by_follow_up
  FROM candidates
)
UPDATE "ProspectActivity" a
SET "followUpId" = r.follow_up_id,
    "outcome" = COALESCE(a."outcome", f."outcome")
FROM ranked r
JOIN "FollowUp" f ON f."id" = r.follow_up_id
WHERE a."id" = r.activity_id AND r.by_activity = 1 AND r.by_follow_up = 1;

-- 7c. Otherwise create it from the follow-up itself.
INSERT INTO "ProspectActivity"
  ("id", "prospectId", "type", "title", "summary", "outcome", "followUpId",
   "createdById", "occurredAt", "createdAt", "updatedAt", "metadata")
SELECT gen_random_uuid()::text,
       f."prospectId",
       f."type"::text::"ProspectActivityType",
       CASE f."type"::text
         WHEN 'CALL' THEN 'Call'
         WHEN 'IN_PERSON_MEETING' THEN 'In-person meeting'
         WHEN 'VIRTUAL_MEETING' THEN 'Virtual meeting'
         WHEN 'EMAIL' THEN 'Email'
         WHEN 'WHATSAPP' THEN 'WhatsApp'
         WHEN 'TEXT' THEN 'SMS / Text'
         WHEN 'SITE_VISIT' THEN 'Site visit'
         ELSE 'Meeting'
       END,
       COALESCE(NULLIF(btrim(f."completionRemark"), ''), 'Follow-up completed'),
       f."outcome",
       f."id",
       f."completedById",
       f."completedAt",
       f."completedAt",
       f."completedAt",
       jsonb_build_object('migratedFrom', 'COMPLETED_FOLLOW_UP_WITHOUT_EVENT',
                          'typeSource', 'scheduled_follow_up_type')
FROM "FollowUp" f
WHERE f."status" = 'COMPLETED'
  AND NOT EXISTS (
    SELECT 1 FROM "ProspectActivity" x
    WHERE x."followUpId" = f."id"
      AND x."type" IN ('CALL', 'IN_PERSON_MEETING', 'VIRTUAL_MEETING', 'EMAIL',
                       'WHATSAPP', 'TEXT', 'SITE_VISIT', 'NOTE', 'MEETING')
  );

-- 8. Outcome column from the metadata older versions stored it in -------------------
UPDATE "ProspectActivity"
SET "outcome" = ("metadata"->>'outcome')::"FollowUpOutcome"
WHERE "outcome" IS NULL
  AND "metadata"->>'outcome' IN ('SUCCESSFUL', 'NO_RESPONSE', 'NOT_INTERESTED', 'RESCHEDULED', 'OTHER')
  AND "type" IN ('CALL', 'IN_PERSON_MEETING', 'VIRTUAL_MEETING', 'EMAIL',
                 'WHATSAPP', 'TEXT', 'SITE_VISIT', 'MEETING');

-- 9. Invariants: anything inconsistent rolls the whole migration back --------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "FollowUp" f JOIN "Prospect" p ON p."id" = f."prospectId"
    WHERE f."status" = 'PENDING' AND (p."stage" IN ('WON', 'LOST') OR p."deletedAt" IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'A pending follow-up remains on a won, lost or deleted prospect';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "FollowUp" f
    WHERE f."status" = 'COMPLETED'
      AND (
        SELECT count(*) FROM "ProspectActivity" a
        WHERE a."followUpId" = f."id"
          AND a."type" IN ('CALL', 'IN_PERSON_MEETING', 'VIRTUAL_MEETING', 'EMAIL',
                           'WHATSAPP', 'TEXT', 'SITE_VISIT', 'NOTE', 'MEETING')
      ) <> 1
  ) THEN
    RAISE EXCEPTION 'A completed follow-up does not have exactly one completing activity';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "ProspectActivity" a JOIN "FollowUp" f ON f."id" = a."followUpId"
    WHERE f."prospectId" <> a."prospectId"
  ) THEN
    RAISE EXCEPTION 'An activity is linked to a follow-up of another prospect';
  END IF;

  IF EXISTS (SELECT 1 FROM "FollowUp" WHERE "dueAt" IS NULL OR "scheduledTime" IS NULL) THEN
    RAISE EXCEPTION 'A follow-up has no due time';
  END IF;

  IF EXISTS (SELECT 1 FROM "Prospect" WHERE "stage" IN ('WON', 'LOST') AND "closedAt" IS NULL) THEN
    RAISE EXCEPTION 'A won or lost prospect has no closing time';
  END IF;
END $$;
