-- Permission es un catálogo GLOBAL de lectura para runtime: su administración
-- queda reservada a una capacidad global específica futura (RBAC-07).
REVOKE INSERT, UPDATE, DELETE ON public.permissions FROM ferresaas_runtime;
