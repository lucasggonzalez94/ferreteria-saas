-- PR 3.2 (hardening Identity, 2026-10-13): las funciones SECURITY DEFINER
-- heredaban como owner al rol que aplicó la migration (en dev: un superuser).
-- Con FORCE RLS en las tablas protegidas, eso significa que el rol "correcto"
-- para definirlas debe poder leer entre tenants: se crea un rol definer
-- dedicado, NOLOGIN (nadie puede conectarse ni ejecutar nada fuera de las
-- funciones que posee), sin superuser y con BYPASSRLS limitado a su labor.
--
-- Requisito de provisionamiento: el rol que aplica esta migration debe poder
-- CREATE ROLE con BYPASSRLS (superuser — igual que la foundation al crear
-- ferresaas_runtime). En entornos donde el migrador no sea superuser, este
-- paso es una tarea operativa documentada.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ferresaas_secdef') THEN
    CREATE ROLE ferresaas_secdef NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS;
  END IF;
END $$;

-- Idempotente: si el rol ya existía, garantiza el flag requerido.
ALTER ROLE ferresaas_secdef BYPASSRLS;

-- Grants mínimos: sólo lectura de lo que las funciones consultan y UPDATE del
-- buzón que el worker opera. Sin DELETE, sin INSERT, sin otras tablas.
GRANT USAGE ON SCHEMA private TO ferresaas_secdef;
GRANT SELECT ON public.users, public.businesses, public.auth_sessions, public.consumed_refresh_tokens TO ferresaas_secdef;
GRANT SELECT, UPDATE ON public.email_jobs TO ferresaas_secdef;

ALTER FUNCTION private.login_identity(text) OWNER TO ferresaas_secdef;
ALTER FUNCTION private.identity_conflicts(text, text) OWNER TO ferresaas_secdef;
ALTER FUNCTION private.session_tenant_by_hash(text) OWNER TO ferresaas_secdef;
ALTER FUNCTION private.session_tenant_by_id(text) OWNER TO ferresaas_secdef;
ALTER FUNCTION private.consumed_token_tenant(text) OWNER TO ferresaas_secdef;
ALTER FUNCTION private.reset_identity(text) OWNER TO ferresaas_secdef;
ALTER FUNCTION private.claim_email_job(text, integer) OWNER TO ferresaas_secdef;
ALTER FUNCTION private.finish_email_job(text, text, text, timestamptz, text) OWNER TO ferresaas_secdef;

-- Las funciones de trigger (private.bump_security / bump_authorization) no son
-- SECURITY DEFINER: corren como quien dispara la escritura; se conservan owned
-- por el rol migrador por definición, sin capacidad extra que reasignar.
