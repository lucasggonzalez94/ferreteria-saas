-- AddColumn businessId to price_history (nullable first)
ALTER TABLE "price_history" ADD COLUMN "businessId" TEXT;

-- Update price_history with businessId from related product
UPDATE "price_history" ph
SET "businessId" = p."businessId"
FROM "products" p
WHERE ph."productId" = p."id" AND ph."businessId" IS NULL;

-- Make businessId NOT NULL
ALTER TABLE "price_history" ALTER COLUMN "businessId" SET NOT NULL;

-- AddForeignKey for price_history
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex for price_history
CREATE INDEX "price_history_businessId_idx" ON "price_history"("businessId");

-- AddColumn businessId to cash_movements (nullable first)
ALTER TABLE "cash_movements" ADD COLUMN "businessId" TEXT;

-- Update cash_movements with businessId from related cash_register_session
UPDATE "cash_movements" cm
SET "businessId" = crs."businessId"
FROM "cash_register_sessions" crs
WHERE cm."cashRegisterId" = crs."id" AND cm."businessId" IS NULL;

-- Make businessId NOT NULL
ALTER TABLE "cash_movements" ALTER COLUMN "businessId" SET NOT NULL;

-- AddForeignKey for cash_movements
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex for cash_movements
CREATE INDEX "cash_movements_businessId_idx" ON "cash_movements"("businessId");

-- AddColumn businessId to account_movements (nullable first)
ALTER TABLE "account_movements" ADD COLUMN "businessId" TEXT;

-- Update account_movements with businessId from related customer
UPDATE "account_movements" am
SET "businessId" = c."businessId"
FROM "customers" c
WHERE am."customerId" = c."id" AND am."businessId" IS NULL;

-- Make businessId NOT NULL
ALTER TABLE "account_movements" ALTER COLUMN "businessId" SET NOT NULL;

-- AddForeignKey for account_movements
ALTER TABLE "account_movements" ADD CONSTRAINT "account_movements_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex for account_movements
CREATE INDEX "account_movements_businessId_idx" ON "account_movements"("businessId");
