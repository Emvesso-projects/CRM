-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('IMAGE', 'DOCUMENT');

-- CreateTable
CREATE TABLE "QuotationAttachment" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "type" "AttachmentType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotationAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuotationAttachment_quotationId_idx" ON "QuotationAttachment"("quotationId");

-- CreateIndex
CREATE INDEX "QuotationAttachment_organizationId_idx" ON "QuotationAttachment"("organizationId");

-- CreateIndex
CREATE INDEX "QuotationAttachment_key_idx" ON "QuotationAttachment"("key");

-- AddForeignKey
ALTER TABLE "QuotationAttachment" ADD CONSTRAINT "QuotationAttachment_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationAttachment" ADD CONSTRAINT "QuotationAttachment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
