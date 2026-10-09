-- AUTH-02: la resolución previa al tenant sólo admite búsquedas puntuales.
-- No editar la migración histórica: las políticas SELECT permisivas se retiran
-- después de crear las capacidades que necesitan login y sesiones existentes.
CREATE FUNCTION private.login_identity(p_email text)
RETURNS TABLE(id text, business_id text, password_hash text, active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT u.id, u."businessId", u.password, u."isActive"
  FROM public.users u WHERE u.email = p_email LIMIT 1
$$;

CREATE FUNCTION private.identity_conflicts(p_email text, p_cuit text)
RETURNS TABLE(email_exists boolean, cuit_exists boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS(SELECT 1 FROM public.users WHERE email = p_email),
         EXISTS(SELECT 1 FROM public.businesses WHERE cuit = p_cuit)
$$;

CREATE FUNCTION private.session_tenant_by_hash(p_hash text)
RETURNS TABLE(id text, business_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.id, s."businessId" FROM public.auth_sessions s
  WHERE s."tokenHash" = p_hash LIMIT 1
$$;

CREATE FUNCTION private.session_tenant_by_id(p_id text)
RETURNS TABLE(business_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s."businessId" FROM public.auth_sessions s WHERE s.id = p_id LIMIT 1
$$;

CREATE FUNCTION private.consumed_token_tenant(p_hash text)
RETURNS TABLE(session_id text, business_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c."sessionId", c."businessId" FROM public.consumed_refresh_tokens c
  WHERE c."tokenHash" = p_hash LIMIT 1
$$;

CREATE FUNCTION private.reset_identity(p_hash text)
RETURNS TABLE(id text, business_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT u.id, u."businessId" FROM public.users u
  WHERE u."resetToken" = p_hash AND u."resetTokenExpiry" > CURRENT_TIMESTAMP LIMIT 1
$$;

REVOKE ALL ON FUNCTION private.login_identity(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.identity_conflicts(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.session_tenant_by_hash(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.session_tenant_by_id(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.consumed_token_tenant(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.reset_identity(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.login_identity(text),
  private.identity_conflicts(text, text), private.session_tenant_by_hash(text),
  private.session_tenant_by_id(text), private.consumed_token_tenant(text),
  private.reset_identity(text) TO ferresaas_runtime;

DROP POLICY identity_bootstrap_users ON public.users;
DROP POLICY identity_bootstrap_businesses ON public.businesses;
DROP POLICY identity_bootstrap_sessions ON public.auth_sessions;
DROP POLICY identity_bootstrap_consumed ON public.consumed_refresh_tokens;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.businesses FORCE ROW LEVEL SECURITY;
ALTER TABLE public.auth_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.consumed_refresh_tokens FORCE ROW LEVEL SECURITY;
