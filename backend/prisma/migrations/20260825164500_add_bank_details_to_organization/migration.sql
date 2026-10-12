-- AlterTable
ALTER TABLE "Organization"
ADD COLUMN "bankName" TEXT,
ADD COLUMN "accountHolderName" TEXT,
ADD COLUMN "accountNumber" TEXT,
ADD COLUMN "ifscCode" TEXT,
ADD COLUMN "branchName" TEXT,
ADD COLUMN "accountType" TEXT;
