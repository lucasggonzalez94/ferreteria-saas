-- DropForeignKey
ALTER TABLE "account_movements" DROP CONSTRAINT "account_movements_customerId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_userId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "auth_sessions" DROP CONSTRAINT "auth_sessions_businessId_fkey";

-- DropForeignKey
ALTER TABLE "auth_sessions" DROP CONSTRAINT "auth_sessions_userId_fkey";

-- DropForeignKey
ALTER TABLE "auth_sessions" DROP CONSTRAINT "auth_sessions_userId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "cash_movements" DROP CONSTRAINT "cash_movements_cashRegisterId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "cash_register_sessions" DROP CONSTRAINT "cash_register_sessions_closingExchangeRateId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "cash_register_sessions" DROP CONSTRAINT "cash_register_sessions_openingExchangeRateId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "cash_register_sessions" DROP CONSTRAINT "cash_register_sessions_userId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "categories" DROP CONSTRAINT "categories_parentId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "check_register" DROP CONSTRAINT "check_register_accountId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "check_register" DROP CONSTRAINT "check_register_payableId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "check_register" DROP CONSTRAINT "check_register_paymentId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "consumed_refresh_tokens" DROP CONSTRAINT "consumed_refresh_tokens_businessId_fkey";

-- DropForeignKey
ALTER TABLE "consumed_refresh_tokens" DROP CONSTRAINT "consumed_refresh_tokens_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "consumed_refresh_tokens" DROP CONSTRAINT "consumed_refresh_tokens_sessionId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "discount_approvals" DROP CONSTRAINT "discount_approvals_approvedBy_fkey_tenant";

-- DropForeignKey
ALTER TABLE "discount_approvals" DROP CONSTRAINT "discount_approvals_productId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "discount_approvals" DROP CONSTRAINT "discount_approvals_rejectedBy_fkey_tenant";

-- DropForeignKey
ALTER TABLE "discount_approvals" DROP CONSTRAINT "discount_approvals_requestedBy_fkey_tenant";

-- DropForeignKey
ALTER TABLE "discount_approvals" DROP CONSTRAINT "discount_approvals_saleItemId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "email_jobs" DROP CONSTRAINT "email_jobs_businessId_fkey";

-- DropForeignKey
ALTER TABLE "financial_movements" DROP CONSTRAINT "financial_movements_accountId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "financial_movements" DROP CONSTRAINT "financial_movements_transferFromAccountId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "financial_movements" DROP CONSTRAINT "financial_movements_transferToAccountId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_productId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_userId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "invoice_jobs" DROP CONSTRAINT "invoice_jobs_saleId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_relatedInvoiceId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_saleId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_exchangeRateId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_saleId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "price_history" DROP CONSTRAINT "price_history_productId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "price_suggestions" DROP CONSTRAINT "price_suggestions_productId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "price_suggestions" DROP CONSTRAINT "price_suggestions_purchaseId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_brandId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_categoryId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_parentId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "purchase_attachments" DROP CONSTRAINT "purchase_attachments_purchaseId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "purchase_items" DROP CONSTRAINT "purchase_items_productId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "purchase_items" DROP CONSTRAINT "purchase_items_purchaseId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "purchases" DROP CONSTRAINT "purchases_exchangeRateId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "purchases" DROP CONSTRAINT "purchases_supplierId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_roleId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "sale_items" DROP CONSTRAINT "sale_items_productId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "sale_items" DROP CONSTRAINT "sale_items_saleId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "sale_refund_items" DROP CONSTRAINT "sale_refund_items_productId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "sale_refund_items" DROP CONSTRAINT "sale_refund_items_saleItemId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "sale_refund_items" DROP CONSTRAINT "sale_refund_items_saleRefundId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "sale_refund_payments" DROP CONSTRAINT "sale_refund_payments_saleRefundId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "sale_refunds" DROP CONSTRAINT "sale_refunds_saleId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_cashRegisterId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_customerId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "supplier_payables" DROP CONSTRAINT "supplier_payables_purchaseId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "supplier_payables" DROP CONSTRAINT "supplier_payables_supplierId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "supplier_payments" DROP CONSTRAINT "supplier_payments_exchangeRateId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "supplier_payments" DROP CONSTRAINT "supplier_payments_payableId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_roleId_fkey_tenant";

-- DropForeignKey
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_userId_fkey_tenant";

-- DropIndex
DROP INDEX "account_movements_tenant_id_key";

-- DropIndex
DROP INDEX "audit_logs_tenant_id_key";

-- DropIndex
DROP INDEX "auth_sessions_tenant_id_key";

-- DropIndex
DROP INDEX "brands_tenant_id_key";

-- DropIndex
DROP INDEX "business_arca_credentials_tenant_id_key";

-- DropIndex
DROP INDEX "cash_movements_tenant_id_key";

-- DropIndex
DROP INDEX "cash_register_sessions_tenant_id_key";

-- DropIndex
DROP INDEX "categories_tenant_id_key";

-- DropIndex
DROP INDEX "check_register_tenant_id_key";

-- DropIndex
DROP INDEX "consumed_refresh_tokens_tenant_id_key";

-- DropIndex
DROP INDEX "customers_tenant_id_key";

-- DropIndex
DROP INDEX "discount_approvals_tenant_id_key";

-- DropIndex
DROP INDEX "exchange_rate_configs_tenant_id_key";

-- DropIndex
DROP INDEX "exchange_rate_snapshots_tenant_id_key";

-- DropIndex
DROP INDEX "financial_accounts_tenant_id_key";

-- DropIndex
DROP INDEX "financial_movements_tenant_id_key";

-- DropIndex
DROP INDEX "idempotency_keys_tenant_id_key";

-- DropIndex
DROP INDEX "inventory_movements_tenant_id_key";

-- DropIndex
DROP INDEX "invoice_jobs_tenant_id_key";

-- DropIndex
DROP INDEX "invoices_tenant_id_key";

-- DropIndex
DROP INDEX "payments_tenant_id_key";

-- DropIndex
DROP INDEX "price_history_tenant_id_key";

-- DropIndex
DROP INDEX "price_suggestions_tenant_id_key";

-- DropIndex
DROP INDEX "products_tenant_id_key";

-- DropIndex
DROP INDEX "purchase_attachments_tenant_id_key";

-- DropIndex
DROP INDEX "purchase_items_tenant_id_key";

-- DropIndex
DROP INDEX "purchases_tenant_id_key";

-- DropIndex
DROP INDEX "role_permissions_tenant_id_key";

-- DropIndex
DROP INDEX "roles_tenant_id_key";

-- DropIndex
DROP INDEX "sale_items_tenant_id_key";

-- DropIndex
DROP INDEX "sale_refund_items_tenant_id_key";

-- DropIndex
DROP INDEX "sale_refund_payments_tenant_id_key";

-- DropIndex
DROP INDEX "sale_refunds_tenant_id_key";

-- DropIndex
DROP INDEX "sales_tenant_id_key";

-- DropIndex
DROP INDEX "supplier_payables_tenant_id_key";

-- DropIndex
DROP INDEX "supplier_payments_tenant_id_key";

-- DropIndex
DROP INDEX "suppliers_tenant_id_key";

-- DropIndex
DROP INDEX "user_roles_tenant_id_key";

-- DropIndex
DROP INDEX "users_tenant_id_key";

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "businessId" SET DEFAULT current_setting('app.business_id', true);

-- AlterTable
ALTER TABLE "purchase_attachments" ALTER COLUMN "businessId" SET DEFAULT current_setting('app.business_id', true);

-- AlterTable
ALTER TABLE "purchase_items" ALTER COLUMN "businessId" SET DEFAULT current_setting('app.business_id', true);

-- AlterTable
ALTER TABLE "role_permissions" ALTER COLUMN "businessId" SET DEFAULT current_setting('app.business_id', true);

-- AlterTable
ALTER TABLE "sale_items" ALTER COLUMN "businessId" SET DEFAULT current_setting('app.business_id', true);

-- AlterTable
ALTER TABLE "sale_refund_items" ALTER COLUMN "businessId" SET DEFAULT current_setting('app.business_id', true);

-- AlterTable
ALTER TABLE "sale_refund_payments" ALTER COLUMN "businessId" SET DEFAULT current_setting('app.business_id', true);

-- AlterTable
ALTER TABLE "user_roles" ALTER COLUMN "businessId" SET DEFAULT current_setting('app.business_id', true);

-- CreateIndex
CREATE INDEX "auth_sessions_tokenHash_idx" ON "auth_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "consumed_refresh_tokens_businessId_idx" ON "consumed_refresh_tokens"("businessId");

-- CreateIndex
CREATE INDEX "email_jobs_businessId_idx" ON "email_jobs"("businessId");

-- CreateIndex
CREATE INDEX "inventory_movements_userId_idx" ON "inventory_movements"("userId");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumed_refresh_tokens" ADD CONSTRAINT "consumed_refresh_tokens_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "auth_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumed_refresh_tokens" ADD CONSTRAINT "consumed_refresh_tokens_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_jobs" ADD CONSTRAINT "email_jobs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idempotency_keys_businessId_endpoint_key" RENAME TO "idempotency_keys_businessId_endpoint_clientOperationId_key";
