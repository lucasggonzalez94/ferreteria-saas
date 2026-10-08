-- Rol runtime de la API: sin superuser, sin BYPASSRLS, sin DDL.
-- Se ejecuta al inicializar el volumen de PostgreSQL local.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ferresaas_runtime') THEN
    CREATE ROLE ferresaas_runtime LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE
      PASSWORD 'runtime_dev_password';
  END IF;
END $$;

GRANT CONNECT ON DATABASE ferresaas TO ferresaas_runtime;
GRANT USAGE ON SCHEMA public TO ferresaas_runtime;
GRANT USAGE ON SCHEMA private TO ferresaas_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ferresaas_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ferresaas_runtime;
