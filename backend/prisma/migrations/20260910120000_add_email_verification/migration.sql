-- Email ownership verification.
--
-- Existing users are left with a NULL "emailVerifiedAt" (unverified). They keep
-- full access: requireVerifiedEmail gates only a couple of write routes, and
-- backfilling everyone to "verified" would defeat the point of adding this.

ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

CREATE TABLE "EmailVerificationOtp" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "otpHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  "requestedIp" TEXT,
  "requestedUserAgent" TEXT,
  "consumedIp" TEXT,
  "consumedUserAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailVerificationOtp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailVerificationOtp_otpHash_key" ON "EmailVerificationOtp"("otpHash");
CREATE INDEX "EmailVerificationOtp_userId_idx" ON "EmailVerificationOtp"("userId");
CREATE INDEX "EmailVerificationOtp_expiresAt_idx" ON "EmailVerificationOtp"("expiresAt");

ALTER TABLE "EmailVerificationOtp"
  ADD CONSTRAINT "EmailVerificationOtp_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
