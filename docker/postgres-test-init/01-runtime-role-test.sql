-- Rol runtime para la base de tests de integración (tmpfs, se recrea en cada arranque).
-- Mismas restricciones que producción: sin superuser, sin BYPASSRLS, sin DDL.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ferresaas_runtime') THEN
    CREATE ROLE ferresaas_runtime LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE
      PASSWORD 'runtime_test_password';
  END IF;
END $$;

GRANT CONNECT ON DATABASE ferresaas_test TO ferresaas_runtime;
GRANT USAGE ON SCHEMA public TO ferresaas_runtime;
-- El schema `private` lo crean las migraciones, que otorgan USAGE/EXECUTE allí.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ferresaas_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ferresaas_runtime;
