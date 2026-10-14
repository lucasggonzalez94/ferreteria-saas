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
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ferresaas_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ferresaas_runtime;

-- PR 3.3: el schema `private` lo crean las migraciones. En un volumen vacío este
-- init corre ANTES de ellas, y un GRANT sobre un schema inexistente aborta el
-- init. Se hace defensivo: las migraciones propias otorgan USAGE/EXECUTE ahí.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_namespace WHERE nspname = 'private') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA private TO ferresaas_runtime';
  END IF;
END $$;
