-- AUTH-02: 20261006021137_add_missing_tables eliminó las FKs tenant-aware.
-- Reconstruirlas para todas las relaciones relevantes sin borrar ni reasignar datos.
-- Ante una relación preexistente entre negocios distintos, abortar la migración.
DO $$
DECLARE r record;
DECLARE collision boolean;
BEGIN
  FOR r IN
    SELECT c.conname, child.relname AS child, parent.relname AS parent, a.attname AS fk
    FROM pg_constraint c
    JOIN pg_class child ON child.oid = c.conrelid
    JOIN pg_class parent ON parent.oid = c.confrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1
      AND c.connamespace = 'public'::regnamespace
      AND a.attname <> 'businessId'
      AND EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = child.oid AND attname = 'businessId')
      AND EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = parent.oid AND attname = 'businessId')
  LOOP
    EXECUTE format(
      'SELECT EXISTS(SELECT 1 FROM public.%I c JOIN public.%I p ON c.%I = p.id WHERE c."businessId" IS DISTINCT FROM p."businessId")',
      r.child, r.parent, r.fk
    ) INTO collision;
    IF collision THEN
      RAISE EXCEPTION 'Cross-tenant relation %.% → %: resolver datos antes de migrar', r.child, r.fk, r.parent;
    END IF;

    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I ("businessId", id)',
      r.parent || '_tenant_id_key', r.parent);
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = r.conname || '_tenant' AND conrelid = ('public.' || quote_ident(r.child))::regclass) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY ("businessId", %I) REFERENCES public.%I ("businessId", id) DEFERRABLE INITIALLY DEFERRED',
        r.child, r.conname || '_tenant', r.fk, r.parent
      );
    END IF;
  END LOOP;
END $$;
