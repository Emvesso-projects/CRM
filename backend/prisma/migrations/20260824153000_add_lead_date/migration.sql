-- AlterTable
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "leadDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill leadDate with createdAt for existing rows
UPDATE "Lead" SET "leadDate" = "createdAt" WHERE "leadDate" IS NULL;

-- DropIndex
DROP INDEX IF EXISTS "Lead_organizationId_createdAt_idx";
DROP INDEX IF EXISTS "Lead_organizationId_status_assignedToId_createdAt_idx";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Lead_organizationId_leadDate_idx" ON "Lead"("organizationId", "leadDate");
CREATE INDEX IF NOT EXISTS "Lead_organizationId_status_assignedToId_leadDate_idx" ON "Lead"("organizationId", "status", "assignedToId", "leadDate");
