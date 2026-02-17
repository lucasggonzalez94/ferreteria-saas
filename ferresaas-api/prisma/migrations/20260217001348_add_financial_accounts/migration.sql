-- CreateTable
CREATE TABLE "financial_accounts" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "walletProvider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_movements" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "transferFromAccountId" TEXT,
    "transferToAccountId" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "financial_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financial_accounts_businessId_idx" ON "financial_accounts"("businessId");

-- CreateIndex
CREATE INDEX "financial_accounts_type_idx" ON "financial_accounts"("type");

-- CreateIndex
CREATE INDEX "financial_accounts_isActive_idx" ON "financial_accounts"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "financial_accounts_businessId_name_key" ON "financial_accounts"("businessId", "name");

-- CreateIndex
CREATE INDEX "financial_movements_businessId_idx" ON "financial_movements"("businessId");

-- CreateIndex
CREATE INDEX "financial_movements_accountId_idx" ON "financial_movements"("accountId");

-- CreateIndex
CREATE INDEX "financial_movements_sourceType_sourceId_idx" ON "financial_movements"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "financial_movements_createdAt_idx" ON "financial_movements"("createdAt");

-- CreateIndex
CREATE INDEX "financial_movements_type_idx" ON "financial_movements"("type");

-- AddForeignKey
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_movements" ADD CONSTRAINT "financial_movements_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_movements" ADD CONSTRAINT "financial_movements_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_movements" ADD CONSTRAINT "financial_movements_transferFromAccountId_fkey" FOREIGN KEY ("transferFromAccountId") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_movements" ADD CONSTRAINT "financial_movements_transferToAccountId_fkey" FOREIGN KEY ("transferToAccountId") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
