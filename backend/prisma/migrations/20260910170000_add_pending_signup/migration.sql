-- Verification moves INSIDE signup.
--
-- The account is now created only after the emailed code comes back, so the
-- after-the-fact machinery is gone: EmailVerificationOtp existed to chase a
-- user whose address was unproven, and Organization.setupCompletedAt existed to
-- remember that they had dismissed the wizard that chased them.
--
-- "User"."emailVerifiedAt" is KEPT. New self-service signups set it at
-- creation; it stays NULL for users a super-admin or admin creates directly.

DROP TABLE "EmailVerificationOtp";

ALTER TABLE "Organization" DROP COLUMN "setupCompletedAt";

-- Holds the signup payload between the two requests. No userId (no user exists
-- yet) and no usedAt/revokedAt — the row is deleted when consumed or
-- superseded, because it carries a bcrypt hash and keeping spent rows around
-- would retain that for nothing.
CREATE TABLE "PendingSignup" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "otpHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  "requestedIp" TEXT,
  "requestedUserAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PendingSignup_pkey" PRIMARY KEY ("id")
);

-- email unique: one pending signup per address, so re-requesting a code
-- replaces the previous row instead of leaving two live ones.
CREATE UNIQUE INDEX "PendingSignup_email_key" ON "PendingSignup"("email");
CREATE UNIQUE INDEX "PendingSignup_otpHash_key" ON "PendingSignup"("otpHash");
CREATE INDEX "PendingSignup_expiresAt_idx" ON "PendingSignup"("expiresAt");
