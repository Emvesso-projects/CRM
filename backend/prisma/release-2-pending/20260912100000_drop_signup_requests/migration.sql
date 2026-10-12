-- Release 2. The signup-request approval workflow was replaced by direct
-- self-service signup in release 1, and release-1 code no longer reads this
-- table. It was left in place during release 1 so that release changed no
-- existing data and master could still be rolled back onto it.
--
-- Export the table before running this. IF EXISTS keeps it a no-op on
-- databases that already dropped it under the old migration name.
DROP TABLE IF EXISTS "SignupRequest";
DROP TYPE IF EXISTS "SignupRequestStatus";
