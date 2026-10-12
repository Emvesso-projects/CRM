-- Drop foreign key constraint
ALTER TABLE "Prospect" DROP CONSTRAINT IF EXISTS "Prospect_followUpAssignedToId_fkey";

-- Drop indexes
DROP INDEX IF EXISTS "Prospect_followUpAssignedToId_idx";
DROP INDEX IF EXISTS "Prospect_followUpDate_idx";

-- Drop legacy follow-up columns from Prospect
ALTER TABLE "Prospect"
  DROP COLUMN IF EXISTS "followUpDate",
  DROP COLUMN IF EXISTS "followUpTime",
  DROP COLUMN IF EXISTS "followUpType",
  DROP COLUMN IF EXISTS "followUpNotes",
  DROP COLUMN IF EXISTS "followUpReminder",
  DROP COLUMN IF EXISTS "followUpAssignedToId";
