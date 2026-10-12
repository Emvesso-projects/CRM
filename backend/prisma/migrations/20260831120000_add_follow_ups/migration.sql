CREATE TYPE "FollowUpStatus" AS ENUM ('PENDING', 'COMPLETED', 'MISSED', 'CANCELLED', 'RESCHEDULED');
CREATE TYPE "FollowUpOutcome" AS ENUM ('SUCCESSFUL', 'NO_RESPONSE', 'NOT_INTERESTED', 'RESCHEDULED', 'OTHER');

CREATE TABLE "FollowUp" (
  "id" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  "scheduledDate" TIMESTAMP(3) NOT NULL,
  "scheduledTime" TEXT,
  "type" "ProspectFollowUpType" NOT NULL,
  "notes" TEXT,
  "reminder" "ProspectReminder",
  "assignedToId" TEXT,
  "status" "FollowUpStatus" NOT NULL DEFAULT 'PENDING',
  "completedAt" TIMESTAMP(3),
  "completedById" TEXT,
  "outcome" "FollowUpOutcome",
  "completionRemark" TEXT,
  "missedReason" TEXT,
  "rescheduledToId" TEXT,
  "createdById" TEXT,
  "organizationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FollowUp_rescheduledToId_key" ON "FollowUp"("rescheduledToId");
CREATE INDEX "FollowUp_prospectId_status_idx" ON "FollowUp"("prospectId", "status");
CREATE INDEX "FollowUp_assignedToId_status_scheduledDate_idx" ON "FollowUp"("assignedToId", "status", "scheduledDate");
CREATE INDEX "FollowUp_organizationId_status_scheduledDate_idx" ON "FollowUp"("organizationId", "status", "scheduledDate");
CREATE INDEX "FollowUp_scheduledDate_idx" ON "FollowUp"("scheduledDate");

ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_rescheduledToId_fkey" FOREIGN KEY ("rescheduledToId") REFERENCES "FollowUp"("id") ON DELETE SET NULL ON UPDATE CASCADE;
