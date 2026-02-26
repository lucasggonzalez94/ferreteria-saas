-- CreateTable
CREATE TABLE "check_register" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "checkNumber" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "payableId" TEXT,
    "paymentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clearedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "recipientName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "check_register_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "check_register_paymentId_key" ON "check_register"("paymentId");

-- CreateIndex
CREATE INDEX "check_register_businessId_idx" ON "check_register"("businessId");

-- CreateIndex
CREATE INDEX "check_register_accountId_idx" ON "check_register"("accountId");

-- CreateIndex
CREATE INDEX "check_register_status_idx" ON "check_register"("status");

-- CreateIndex
CREATE INDEX "check_register_payableId_idx" ON "check_register"("payableId");

-- CreateIndex
CREATE UNIQUE INDEX "check_register_businessId_checkNumber_key" ON "check_register"("businessId", "checkNumber");

-- AddForeignKey
ALTER TABLE "check_register" ADD CONSTRAINT "check_register_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_register" ADD CONSTRAINT "check_register_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_register" ADD CONSTRAINT "check_register_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "supplier_payables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_register" ADD CONSTRAINT "check_register_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "supplier_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
