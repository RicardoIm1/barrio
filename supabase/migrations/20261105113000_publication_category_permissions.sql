-- Permiso predeterminado: usuarios normales publican en Varios.
-- Administradores activos pueden publicar en todas las categorías.
ALTER TABLE public.usuarios
  ALTER COLUMN categorias SET DEFAULT 'varios';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  insert into public.usuarios (
    id, email, nombre, rol, categorias, telefono
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'nombre',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    'usuario',
    'varios',
    new.raw_user_meta_data->>'telefono'
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

UPDATE public.usuarios
SET categorias = CASE WHEN rol = 'admin' THEN 'todas' ELSE 'varios' END;

CREATE OR REPLACE FUNCTION private.proteger_campos_aviso()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid;
  v_categorias text;
  v_permitidas text[];
  v_categoria text;
  v_verificar_categoria boolean := false;
BEGIN
  v_uid := (SELECT auth.uid());
  v_categoria := lower(trim(coalesce(NEW.categoria, '')));

  IF v_categoria NOT IN ('urgente','escuelas','servicios','comercios','eventos','gobierno','varios') THEN
    RAISE EXCEPTION 'La categoría de publicación no es válida.'
      USING ERRCODE = '22023';
  END IF;

  IF v_uid IS NOT NULL AND NOT COALESCE(private.es_admin(), false) THEN
    IF TG_OP = 'INSERT' THEN
      v_verificar_categoria := true;
    ELSE
      v_verificar_categoria := NEW.categoria IS DISTINCT FROM OLD.categoria;
    END IF;

    IF v_verificar_categoria THEN
      SELECT lower(trim(coalesce(u.categorias, 'varios')))
        INTO v_categorias
      FROM public.usuarios u
      WHERE u.id = v_uid
        AND coalesce(u.activo, true) = true;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe un perfil activo para publicar.'
          USING ERRCODE = '42501';
      END IF;

      -- "todas" es un valor histórico. Nunca amplía permisos de un usuario normal.
      IF v_categorias = 'todas' OR v_categorias = '' THEN
        v_permitidas := ARRAY['varios'];
      ELSE
        SELECT array_agg(lower(trim(x)))
          INTO v_permitidas
        FROM unnest(string_to_array(v_categorias, ',')) AS x;
      END IF;

      IF NOT (v_categoria = ANY(coalesce(v_permitidas, ARRAY['varios']))) THEN
        RAISE EXCEPTION 'No tienes autorización para publicar en la categoría seleccionada.'
          USING ERRCODE = '42501';
      END IF;
    END IF;

    IF TG_OP = 'INSERT' THEN
      IF COALESCE(NEW.urgente, false) OR COALESCE(NEW.destacado, false) THEN
        RAISE EXCEPTION 'Solo un administrador puede activar urgente o destacado.'
          USING ERRCODE = '42501';
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.urgente IS DISTINCT FROM OLD.urgente
         OR NEW.destacado IS DISTINCT FROM OLD.destacado THEN
        RAISE EXCEPTION 'Solo un administrador puede modificar urgente o destacado.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
