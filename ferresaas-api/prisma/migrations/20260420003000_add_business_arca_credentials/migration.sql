CREATE TABLE "business_arca_credentials" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "cuit" TEXT NOT NULL,
  "environment" TEXT NOT NULL DEFAULT 'homo',
  "wsfeUrl" TEXT,
  "wsaaUrl" TEXT,
  "serviceName" TEXT NOT NULL DEFAULT 'wsfe',
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "tokenEncrypted" TEXT,
  "signEncrypted" TEXT,
  "tokenExpiresAt" TIMESTAMP(3),
  "certificatePemEncrypted" TEXT,
  "privateKeyPemEncrypted" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "business_arca_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "business_arca_credentials_businessId_key" ON "business_arca_credentials"("businessId");
CREATE INDEX "business_arca_credentials_businessId_idx" ON "business_arca_credentials"("businessId");
CREATE INDEX "business_arca_credentials_isEnabled_idx" ON "business_arca_credentials"("isEnabled");

ALTER TABLE "business_arca_credentials"
ADD CONSTRAINT "business_arca_credentials_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
