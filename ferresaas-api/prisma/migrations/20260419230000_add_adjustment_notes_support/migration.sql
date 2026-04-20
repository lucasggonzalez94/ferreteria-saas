ALTER TABLE "invoices"
ADD COLUMN "relatedInvoiceId" TEXT,
ADD COLUMN "adjustmentKind" TEXT,
ADD COLUMN "adjustmentReason" TEXT;

DROP INDEX IF EXISTS "invoices_saleId_key";

CREATE INDEX "invoices_saleId_idx" ON "invoices"("saleId");
CREATE UNIQUE INDEX "invoices_saleId_voucherType_key" ON "invoices"("saleId", "voucherType");
CREATE INDEX "invoices_relatedInvoiceId_idx" ON "invoices"("relatedInvoiceId");

ALTER TABLE "invoices"
ADD CONSTRAINT "invoices_relatedInvoiceId_fkey"
FOREIGN KEY ("relatedInvoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
