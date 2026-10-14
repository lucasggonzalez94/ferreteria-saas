-- Fix PR 3.2 (hardening Identity): las funciones private.* ejecutan como el rol
-- definer (SECURITY DEFINER). El definer necesita USAGE sobre el schema public
-- para resolver public.users / public.email_jobs / etc. En la base de tests
-- funcionaba de casualidad (USAGE para PUBLIC aún vigente ahí); en dev fallaba
-- con 42501 porque sólo `user` y `ferresaas_runtime` tenían USAGE explícito.
-- El grant se hace explícito para que no dependa del default del esquema.

GRANT USAGE ON SCHEMA public TO ferresaas_secdef;
