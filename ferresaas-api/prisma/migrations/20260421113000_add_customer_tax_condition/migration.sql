-- Add customer tax condition for ARCA receptor IVA condition mapping
ALTER TABLE "customers"
ADD COLUMN "taxCondition" TEXT NOT NULL DEFAULT 'CONSUMIDOR_FINAL';
