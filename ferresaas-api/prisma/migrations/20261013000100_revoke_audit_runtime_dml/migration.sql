-- Hardening Identity (2026-10-13): el rol runtime no debe borrar ni modificar
-- la auditoría. AuditStore sólo hace INSERT; UPDATE/DELETE no tienen consumidor legítimo.
-- Comprobado en Fase 0: ferresaas_runtime tenía SELECT/INSERT/UPDATE/DELETE sobre audit_logs.
REVOKE UPDATE, DELETE ON TABLE public.audit_logs FROM ferresaas_runtime;

-- Blindaje ante nuevas tablas/roles: los default privileges de docker/postgres-init
-- otorgan DML amplio a futuro; audit_logs queda explícitamente restringido acá y
-- regla 9 de refactoring-policy exige revisar grants en toda tabla nueva.
