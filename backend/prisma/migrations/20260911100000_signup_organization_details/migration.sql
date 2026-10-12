-- Self-service signup now collects the organization's details, not just its
-- name. They are held on PendingSignup until the emailed code is confirmed, and
-- only then written to Organization / User.

-- PendingSignup only ever holds codes under 15 minutes old. Clearing it lets the
-- new required columns be added without inventing defaults for rows that would
-- have no real value. Worst case, a signup in progress requests a fresh code.
DELETE FROM "PendingSignup";

ALTER TABLE "PendingSignup"
  ADD COLUMN "mobile" TEXT NOT NULL,
  ADD COLUMN "orgType" TEXT NOT NULL,
  ADD COLUMN "orgMobile" TEXT NOT NULL,
  ADD COLUMN "address" TEXT NOT NULL,
  ADD COLUMN "orgEmail" TEXT,
  ADD COLUMN "authorizedPerson" TEXT,
  ADD COLUMN "dateOfRegistration" TIMESTAMP(3),
  ADD COLUMN "gstin" TEXT,
  ADD COLUMN "remark" TEXT;

-- Clearing the placeholder Organization.orgType values ("type1"/"type2") was
-- deliberately moved out of this migration: it rewrites existing rows, and the
-- release that ships this migration must change no existing data, so master can
-- still be rolled back onto it. It ships in release 2 — see
-- prisma/release-2-pending/.
