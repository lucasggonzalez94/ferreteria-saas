-- PR 3.4 (hardening Identity, 2026-10-13): consumed_refresh_tokens registraba
-- expiresAt pero nadie limpiaba la tabla. La limpieza es mantenimiento global
-- sobre tabla tenant-owned con FORCE RLS, así que entra como capacidad global
-- explícita ejecutada por el definer dedicado, no como DML suelto del runtime.

GRANT DELETE ON public.consumed_refresh_tokens TO ferresaas_secdef;

-- Borra hashes consumidos cuya vigencia absoluta ya venció (inútiles para
-- detectar replay: la sesión a la que pertenecen ya no puede estar viva).
CREATE FUNCTION private.purge_consumed_refresh_tokens(p_before timestamptz)
RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  WITH purged AS (
    DELETE FROM public.consumed_refresh_tokens
     WHERE "expiresAt" < p_before
    RETURNING id
  )
  SELECT count(*)::integer FROM purged
$$;

REVOKE ALL ON FUNCTION private.purge_consumed_refresh_tokens(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.purge_consumed_refresh_tokens(timestamptz) TO ferresaas_runtime;

ALTER FUNCTION private.purge_consumed_refresh_tokens(timestamptz) OWNER TO ferresaas_secdef;
