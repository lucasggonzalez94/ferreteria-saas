CREATE TABLE "invoice_jobs" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "voucherType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 8,
  "nextRetryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "invoice_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invoice_jobs_saleId_voucherType_key" ON "invoice_jobs"("saleId", "voucherType");
CREATE INDEX "invoice_jobs_businessId_idx" ON "invoice_jobs"("businessId");
CREATE INDEX "invoice_jobs_status_nextRetryAt_idx" ON "invoice_jobs"("status", "nextRetryAt");

ALTER TABLE "invoice_jobs"
ADD CONSTRAINT "invoice_jobs_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoice_jobs"
ADD CONSTRAINT "invoice_jobs_saleId_fkey"
FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
