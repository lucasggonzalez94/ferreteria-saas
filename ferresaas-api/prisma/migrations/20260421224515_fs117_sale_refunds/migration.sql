-- DropIndex
DROP INDEX "invoices_relatedInvoiceId_idx";

-- CreateTable
CREATE TABLE "sale_refunds" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "defaultPayout" JSONB,
    "appliedPayout" JSONB,
    "notes" TEXT,
    "clientOperationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "sale_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_refund_items" (
    "id" TEXT NOT NULL,
    "saleRefundId" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_refund_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_refund_payments" (
    "id" TEXT NOT NULL,
    "saleRefundId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_refund_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sale_refunds_businessId_idx" ON "sale_refunds"("businessId");

-- CreateIndex
CREATE INDEX "sale_refunds_saleId_idx" ON "sale_refunds"("saleId");

-- CreateIndex
CREATE INDEX "sale_refunds_createdAt_idx" ON "sale_refunds"("createdAt");

-- CreateIndex
CREATE INDEX "sale_refunds_clientOperationId_idx" ON "sale_refunds"("clientOperationId");

-- CreateIndex
CREATE INDEX "sale_refund_items_saleRefundId_idx" ON "sale_refund_items"("saleRefundId");

-- CreateIndex
CREATE INDEX "sale_refund_items_saleItemId_idx" ON "sale_refund_items"("saleItemId");

-- CreateIndex
CREATE INDEX "sale_refund_items_productId_idx" ON "sale_refund_items"("productId");

-- CreateIndex
CREATE INDEX "sale_refund_payments_saleRefundId_idx" ON "sale_refund_payments"("saleRefundId");

-- CreateIndex
CREATE INDEX "sale_refund_payments_method_idx" ON "sale_refund_payments"("method");

-- AddForeignKey
ALTER TABLE "sale_refunds" ADD CONSTRAINT "sale_refunds_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_refunds" ADD CONSTRAINT "sale_refunds_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_refund_items" ADD CONSTRAINT "sale_refund_items_saleRefundId_fkey" FOREIGN KEY ("saleRefundId") REFERENCES "sale_refunds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_refund_items" ADD CONSTRAINT "sale_refund_items_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "sale_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_refund_items" ADD CONSTRAINT "sale_refund_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_refund_payments" ADD CONSTRAINT "sale_refund_payments_saleRefundId_fkey" FOREIGN KEY ("saleRefundId") REFERENCES "sale_refunds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
