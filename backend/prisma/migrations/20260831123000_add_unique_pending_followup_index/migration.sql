CREATE UNIQUE INDEX IF NOT EXISTS "unique_pending_followup_per_prospect"
ON "FollowUp" ("prospectId")
WHERE status = 'PENDING';
