-- Remove plaintext storage of invoice API credentials.
ALTER TABLE "businesses"
  DROP COLUMN IF EXISTS "invoiceApiKey";
