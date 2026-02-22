-- AlterTable
ALTER TABLE "cash_register_sessions" ADD COLUMN     "closingAmountUSD" DECIMAL(12,2),
ADD COLUMN     "closingExchangeRateId" TEXT,
ADD COLUMN     "differenceUSD" DECIMAL(12,2),
ADD COLUMN     "expectedAmountUSD" DECIMAL(12,2),
ADD COLUMN     "openingAmountUSD" DECIMAL(12,2),
ADD COLUMN     "openingExchangeRateId" TEXT;

-- AlterTable
ALTER TABLE "exchange_rate_snapshots" ADD COLUMN     "buyRate" DECIMAL(12,4),
ADD COLUMN     "dollarType" TEXT NOT NULL DEFAULT 'oficial',
ADD COLUMN     "sellRate" DECIMAL(12,4);

-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'ARS',
ADD COLUMN     "exchangeRateId" TEXT;

-- AlterTable
ALTER TABLE "supplier_payments" ADD COLUMN     "amountUSD" DECIMAL(12,2),
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'ARS',
ADD COLUMN     "exchangeRateId" TEXT;

-- CreateTable
CREATE TABLE "exchange_rate_configs" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "usdEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dollarType" TEXT NOT NULL DEFAULT 'oficial',
    "marginPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "autoUpdate" BOOLEAN NOT NULL DEFAULT true,
    "updateIntervalMinutes" INTEGER NOT NULL DEFAULT 30,
    "manualRate" DECIMAL(12,4),
    "useManualRate" BOOLEAN NOT NULL DEFAULT false,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_rate_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rate_configs_businessId_key" ON "exchange_rate_configs"("businessId");

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_exchangeRateId_fkey" FOREIGN KEY ("exchangeRateId") REFERENCES "exchange_rate_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_exchangeRateId_fkey" FOREIGN KEY ("exchangeRateId") REFERENCES "exchange_rate_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register_sessions" ADD CONSTRAINT "cash_register_sessions_openingExchangeRateId_fkey" FOREIGN KEY ("openingExchangeRateId") REFERENCES "exchange_rate_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register_sessions" ADD CONSTRAINT "cash_register_sessions_closingExchangeRateId_fkey" FOREIGN KEY ("closingExchangeRateId") REFERENCES "exchange_rate_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rate_configs" ADD CONSTRAINT "exchange_rate_configs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
