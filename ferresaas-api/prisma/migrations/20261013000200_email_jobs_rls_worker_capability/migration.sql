-- PR 3.1 (hardening Identity, 2026-10-13): email_jobs contenía datos de tenant
-- como tabla operacional global, con DML amplio para el rol runtime: cualquier
-- request podía leer/modificar jobs de otros tenants. Decisión aprobada
-- (decisions/background-jobs.md): RLS + FORCE como el resto de las tablas
-- tenant, y el worker la opera sólo por capacidades globales explícitas.

ALTER TABLE public.email_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.email_jobs
  FOR ALL TO ferresaas_runtime
  USING ("businessId" = NULLIF(current_setting('app.business_id', true), ''))
  WITH CHECK ("businessId" = NULLIF(current_setting('app.business_id', true), ''));

ALTER TABLE public.email_jobs FORCE ROW LEVEL SECURITY;

-- Capacidad global del worker: reclama UN job due con lock exclusivo.
-- El encolado lo sigue haciendo el runtime bajo contexto tenant (RLS).
CREATE FUNCTION private.claim_email_job(p_lock_token text, p_max_attempts integer)
RETURNS TABLE(id text, "businessId" text, recipient text, "firstName" text, attempts integer)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  WITH candidate AS (
    SELECT ej.id
      FROM public.email_jobs ej
     WHERE (ej.status IN ('PENDING','RETRYING') AND ej."availableAt" <= CURRENT_TIMESTAMP
            OR ej.status = 'PROCESSING' AND ej."lockedAt" < CURRENT_TIMESTAMP - INTERVAL '5 minutes')
       AND ej.attempts < p_max_attempts
     ORDER BY ej."availableAt" ASC
     FOR UPDATE SKIP LOCKED
     LIMIT 1
  )
  UPDATE public.email_jobs ej
     SET status = 'PROCESSING',
         "lockedAt" = CURRENT_TIMESTAMP,
         "lockToken" = p_lock_token,
         attempts = ej.attempts + 1
    FROM candidate
   WHERE ej.id = candidate.id
  RETURNING ej.id, ej."businessId", ej.recipient, ej."firstName", ej.attempts
$$;

-- Finalización condicionada por lockToken: un worker tardío no pisa el estado
-- de quien le robó/reclamó el job. Devuelve true sólo si ESTE dueño actualizó.
CREATE FUNCTION private.finish_email_job(p_id text, p_lock_token text, p_status text, p_available_at timestamptz, p_last_error text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  WITH done AS (
    UPDATE public.email_jobs ej
       SET status = p_status,
           "availableAt" = COALESCE(p_available_at, ej."availableAt"),
           "lastError" = p_last_error,
           "lockedAt" = CASE WHEN p_status IN ('RETRYING','FAILED') THEN NULL ELSE ej."lockedAt" END,
           "lockToken" = CASE WHEN p_status IN ('RETRYING','FAILED') THEN NULL ELSE ej."lockToken" END
     WHERE ej.id = p_id AND ej."lockToken" = p_lock_token
    RETURNING ej.id
  )
  SELECT EXISTS (SELECT 1 FROM done)
$$;

-- Nunca ejecutables por cualquier rol: sólo el runtime, y éste no tiene DML
-- libre sobre la tabla (RLS), sólo estas dos capacidades concretas.
REVOKE ALL ON FUNCTION private.claim_email_job(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.finish_email_job(text, text, text, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.claim_email_job(text, integer) TO ferresaas_runtime;
GRANT EXECUTE ON FUNCTION private.finish_email_job(text, text, text, timestamptz, text) TO ferresaas_runtime;

-- NOTA de provisionamiento: estas funciones nacen owned por el rol migrador.
-- La migration siguiente (20261013000300) las reasigna al definer dedicado.
