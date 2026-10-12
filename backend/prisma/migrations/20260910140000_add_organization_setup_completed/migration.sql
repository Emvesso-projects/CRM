-- Post-signup setup acknowledgement.
--
-- Existing organizations are left NULL (never acknowledged), so their admins
-- see the setup checklist once and can dismiss it. Backfilling everyone to
-- "acknowledged" would hide the checklist from exactly the orgs most likely to
-- have an incomplete profile — the ones created before the wizard existed.

ALTER TABLE "Organization" ADD COLUMN "setupCompletedAt" TIMESTAMP(3);
