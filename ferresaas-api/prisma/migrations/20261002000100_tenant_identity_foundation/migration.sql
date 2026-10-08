-- ============================================================================
-- Refactor integral: aislamiento tenant (RLS) + fundaciones de identidad.
-- Decisión: .docs/architecture/decisions/tenant-isolation.md
-- Ruptura documentada: las sesiones JWT legacy se invalidan (nuevo login).
-- La API runtime debe conectar con el rol `ferresaas_runtime` (sin superuser,
-- sin BYPASSRLS, sin DDL). En desarrollo ese rol lo crea docker/postgres-init.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

-- Rol runtime: sin superuser, sin BYPASSRLS, sin DDL. En cada entorno se le
-- da LOGIN + password fuera de este archivo (init del contenedor / secreto).
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ferresaas_runtime') THEN
    CREATE ROLE ferresaas_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO ferresaas_runtime;
GRANT USAGE ON SCHEMA private TO ferresaas_runtime;

-- ----------------------------------------------------------------------------
-- 1. Sesiones nuevas (PostgreSQL autoritativo, refresh opaco hasheado)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS "refresh_token_sessions";

CREATE TABLE "auth_sessions" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "securityVersion" INTEGER NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  CONSTRAINT "auth_sessions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE,
  CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE TABLE "consumed_refresh_tokens" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "consumed_refresh_tokens_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE,
  CONSTRAINT "consumed_refresh_tokens_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "auth_sessions"("id") ON DELETE CASCADE
);
CREATE TABLE "email_jobs" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'WELCOME',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lockToken" TEXT,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_jobs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE
);

ALTER TABLE "businesses" ADD COLUMN "authorizationVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "users" ADD COLUMN "securityVersion" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "auth_sessions_userId_idx" ON "auth_sessions"("userId");
CREATE INDEX "auth_sessions_businessId_idx" ON "auth_sessions"("businessId");
CREATE INDEX "auth_sessions_expiresAt_idx" ON "auth_sessions"("expiresAt");
CREATE INDEX "consumed_refresh_tokens_sessionId_idx" ON "consumed_refresh_tokens"("sessionId");
CREATE INDEX "consumed_refresh_tokens_expiresAt_idx" ON "consumed_refresh_tokens"("expiresAt");
CREATE INDEX "email_jobs_status_availableAt_idx" ON "email_jobs"("status", "availableAt");

-- ----------------------------------------------------------------------------
-- 2. Tenant explícito en tablas dependientes + integridad referencial cruzada
-- ----------------------------------------------------------------------------
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('user_roles','users','userId'), ('role_permissions','roles','roleId'),
    ('sale_items','sales','saleId'), ('payments','sales','saleId'),
    ('purchase_items','purchases','purchaseId'), ('purchase_attachments','purchases','purchaseId'),
    ('sale_refund_items','sale_refunds','saleRefundId'), ('sale_refund_payments','sale_refunds','saleRefundId')
  ) AS x(child,parent,fk) LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN "businessId" TEXT', r.child);
    EXECUTE format(
      'UPDATE public.%I c SET "businessId" = p."businessId" FROM public.%I p WHERE c.%I = p.id',
      r.child, r.parent, r.fk);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN "businessId" SET NOT NULL', r.child);
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN "businessId" SET DEFAULT current_setting(''app.business_id'', true)',
      r.child);
  END LOOP;
END $$;

-- Unicidad tenant-aware (corrige constraints globales defectuosos)
DROP INDEX IF EXISTS "products_internalSku_key";
DROP INDEX IF EXISTS "products_barcode_key";
DROP INDEX IF EXISTS "sales_clientOperationId_key";
DROP INDEX IF EXISTS "idempotency_keys_clientOperationId_key";
CREATE UNIQUE INDEX "products_businessId_internalSku_key" ON "products"("businessId", "internalSku");
CREATE UNIQUE INDEX "products_businessId_barcode_key" ON "products"("businessId", "barcode");
CREATE UNIQUE INDEX "sales_businessId_clientOperationId_key" ON "sales"("businessId", "clientOperationId");
CREATE UNIQUE INDEX "idempotency_keys_businessId_endpoint_key" ON "idempotency_keys"("businessId", "endpoint", "clientOperationId");

-- Claves referenciables (businessId, id) para FKs compuestas
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['users','roles','user_roles','role_permissions','auth_sessions',
    'consumed_refresh_tokens','categories','brands','products','price_history',
    'price_suggestions','inventory_movements','suppliers','purchases','purchase_items',
    'purchase_attachments','supplier_payables','supplier_payments','check_register','sales',
    'sale_items','payments','sale_refunds','sale_refund_items','sale_refund_payments',
    'cash_register_sessions','cash_movements','customers','account_movements','invoices',
    'invoice_jobs','business_arca_credentials','exchange_rate_snapshots','exchange_rate_configs',
    'audit_logs','idempotency_keys','financial_accounts','financial_movements','discount_approvals'] LOOP
    EXECUTE format('CREATE UNIQUE INDEX %I ON public.%I ("businessId", "id")', t||'_tenant_id_key', t);
  END LOOP;
END $$;

-- FKs compuestas admisivas: no reemplazan la FK base; sólo exigen mismo tenant.
-- DEFERRABLE para coexistir con acciones SET NULL de la FK base.
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN
    SELECT c.conname, child.relname AS child, parent.relname AS parent, a.attname AS fk
    FROM pg_constraint c
    JOIN pg_class child  ON child.oid  = c.conrelid
    JOIN pg_class parent ON parent.oid = c.confrelid
    JOIN pg_attribute a  ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1
      AND c.connamespace = 'public'::regnamespace
      AND a.attname <> 'businessId'
      AND EXISTS (SELECT FROM pg_attribute WHERE attrelid = child.oid  AND attname = 'businessId')
      AND EXISTS (SELECT FROM pg_attribute WHERE attrelid = parent.oid AND attname = 'businessId')
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY ("businessId", %I)
         REFERENCES public.%I ("businessId", "id") DEFERRABLE INITIALLY DEFERRED',
      r.child, r.conname || '_tenant', r.fk, r.parent);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Canonización: nunca fusionar identidades silenciosamente
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT lower(trim(email)) FROM "users" GROUP BY lower(trim(email)) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Canonical email collision: resolver identidades antes de migrar';
  END IF;
  IF EXISTS (SELECT cuit FROM "businesses" GROUP BY cuit HAVING count(*) > 1
             AND position('-' in min(cuit)) <> 0) THEN
    RAISE EXCEPTION 'Canonical CUIT collision: resolver negocios antes de migrar';
  END IF;
END $$;
UPDATE "users" SET email = lower(trim(email)) WHERE email <> lower(trim(email));

-- ----------------------------------------------------------------------------
-- 4. RLS: políticas por tabla aplicadas al rol runtime
-- ----------------------------------------------------------------------------
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['businesses','users','roles','user_roles','role_permissions',
    'auth_sessions','consumed_refresh_tokens','categories','brands','products',
    'price_history','price_suggestions','inventory_movements','suppliers','purchases',
    'purchase_items','purchase_attachments','supplier_payables','supplier_payments',
    'check_register','sales','sale_items','payments','sale_refunds','sale_refund_items',
    'sale_refund_payments','cash_register_sessions','cash_movements','customers',
    'account_movements','invoices','invoice_jobs','business_arca_credentials',
    'exchange_rate_snapshots','exchange_rate_configs','audit_logs','idempotency_keys',
    'financial_accounts','financial_movements','discount_approvals'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I FOR ALL TO ferresaas_runtime
         USING (%I = NULLIF(current_setting(''app.business_id'', true), ''''))
         WITH CHECK (%I = NULLIF(current_setting(''app.business_id'', true), ''''))',
      t,
      CASE WHEN t = 'businesses' THEN 'id' ELSE 'businessId' END,
      CASE WHEN t = 'businesses' THEN 'id' ELSE 'businessId' END);
  END LOOP;
END $$;
-- ----------------------------------------------------------------------------
-- 4b. Bootstrap público de identidad: antes de autenticar todavía no existe
-- app.business_id. La lectura de credenciales/sesión crea el contexto; el
-- código indistingue identidad inexistente/inactiva y el rate limit aplica.
-- ----------------------------------------------------------------------------
CREATE POLICY identity_bootstrap_users ON "users" FOR SELECT TO ferresaas_runtime USING (true);
CREATE POLICY identity_bootstrap_businesses ON "businesses" FOR SELECT TO ferresaas_runtime USING (true);
CREATE POLICY identity_bootstrap_sessions ON "auth_sessions" FOR SELECT TO ferresaas_runtime USING (true);
CREATE POLICY identity_bootstrap_consumed ON "consumed_refresh_tokens" FOR SELECT TO ferresaas_runtime USING (true);

-- ----------------------------------------------------------------------------
-- 5. Grants acotados del rol runtime (sin bypass genérico)
-- ----------------------------------------------------------------------------
GRANT SELECT ON "permissions" TO ferresaas_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ferresaas_runtime;

CREATE OR REPLACE FUNCTION private.bump_security() RETURNS trigger LANGUAGE plpgsql
SET search_path = '' AS $$
BEGIN
  IF NEW.password IS DISTINCT FROM OLD.password
     OR NEW."isActive" IS DISTINCT FROM OLD."isActive" THEN
    NEW."securityVersion" := OLD."securityVersion" + 1;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS identity_security ON "users";
CREATE TRIGGER identity_security BEFORE UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION private.bump_security();

CREATE OR REPLACE FUNCTION private.bump_authorization() RETURNS trigger LANGUAGE plpgsql
SET search_path = '' AS $$
BEGIN
  UPDATE public."businesses"
     SET "authorizationVersion" = "authorizationVersion" + 1
   WHERE id = COALESCE(NEW."businessId", OLD."businessId");
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS role_authz ON "roles";
CREATE TRIGGER role_authz AFTER INSERT OR UPDATE OR DELETE ON "roles"
  FOR EACH ROW EXECUTE FUNCTION private.bump_authorization();
DROP TRIGGER IF EXISTS assignment_authz ON "user_roles";
CREATE TRIGGER assignment_authz AFTER INSERT OR UPDATE OR DELETE ON "user_roles"
  FOR EACH ROW EXECUTE FUNCTION private.bump_authorization();
DROP TRIGGER IF EXISTS permission_authz ON "role_permissions";
CREATE TRIGGER permission_authz AFTER INSERT OR UPDATE OR DELETE ON "role_permissions"
  FOR EACH ROW EXECUTE FUNCTION private.bump_authorization();
