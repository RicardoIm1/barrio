-- Permite que el administrador consulte todos los usuarios desde el panel.
-- La autorización real sigue dependiendo de private.es_admin().
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'usuarios'
      AND policyname = 'usuarios_admin_select'
  ) THEN
    CREATE POLICY usuarios_admin_select
      ON public.usuarios
      FOR SELECT
      TO authenticated
      USING ((SELECT private.es_admin()));
  END IF;
END
$$;
