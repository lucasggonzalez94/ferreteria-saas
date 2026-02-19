-- AlterTable
ALTER TABLE "price_history" ADD COLUMN     "newMargin" DECIMAL(5,2),
ADD COLUMN     "oldMargin" DECIMAL(5,2),
ADD COLUMN     "purchaseId" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "costMethod" TEXT NOT NULL DEFAULT 'avg_weighted',
ADD COLUMN     "priceLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pricingMode" TEXT DEFAULT 'margin',
ADD COLUMN     "roundingStep" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "targetMargin" DECIMAL(5,2),
ADD COLUMN     "targetMarkup" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "price_suggestions" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "purchaseId" TEXT,
    "oldCost" DECIMAL(12,2) NOT NULL,
    "newCost" DECIMAL(12,2) NOT NULL,
    "oldPrice" DECIMAL(12,2) NOT NULL,
    "suggestedPrice" DECIMAL(12,2) NOT NULL,
    "oldMargin" DECIMAL(5,2) NOT NULL,
    "newMargin" DECIMAL(5,2) NOT NULL,
    "pricingMode" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "price_suggestions_businessId_idx" ON "price_suggestions"("businessId");

-- CreateIndex
CREATE INDEX "price_suggestions_productId_idx" ON "price_suggestions"("productId");

-- CreateIndex
CREATE INDEX "price_suggestions_purchaseId_idx" ON "price_suggestions"("purchaseId");

-- CreateIndex
CREATE INDEX "price_suggestions_status_idx" ON "price_suggestions"("status");

-- CreateIndex
CREATE INDEX "price_suggestions_requestedAt_idx" ON "price_suggestions"("requestedAt");

-- CreateIndex
CREATE INDEX "price_history_purchaseId_idx" ON "price_history"("purchaseId");

-- AddForeignKey
ALTER TABLE "price_suggestions" ADD CONSTRAINT "price_suggestions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_suggestions" ADD CONSTRAINT "price_suggestions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_suggestions" ADD CONSTRAINT "price_suggestions_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
