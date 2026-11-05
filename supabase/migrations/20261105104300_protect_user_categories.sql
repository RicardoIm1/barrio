-- Los usuarios pueden editar nombre y teléfono, pero no sus campos de autorización.
-- La función se ejecuta antes del UPDATE y valida el rol real en la tabla usuarios.
CREATE OR REPLACE FUNCTION public.proteger_usuarios_campos_sensibles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  hardening boolean;
  is_admin boolean;
  is_trusted_server boolean;
begin
  select coalesce(enabled, false)
    into hardening
  from private.security_flags
  where flag = 'usuarios_hardening_enabled';

  if not coalesce(hardening, false) then
    return new;
  end if;

  is_trusted_server := (select auth.uid()) is null;
  is_admin := coalesce(private.es_admin(), false);

  if is_trusted_server or is_admin then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.email is distinct from old.email
     or new.rol is distinct from old.rol
     or new.categorias is distinct from old.categorias
     or new.activo is distinct from old.activo
     or new.ultimo_acceso is distinct from old.ultimo_acceso
     or new.fecha_registro is distinct from old.fecha_registro
     or new.puntos_confianza is distinct from old.puntos_confianza
     or new.nivel is distinct from old.nivel
     or new.avisos_publicados is distinct from old.avisos_publicados
     or new.reportes_recibidos is distinct from old.reportes_recibidos
     or new.reportes_realizados is distinct from old.reportes_realizados
     or new.votos_positivos_recibidos is distinct from old.votos_positivos_recibidos
     or new.votos_negativos_recibidos is distinct from old.votos_negativos_recibidos
     or new.fecha_verificacion is distinct from old.fecha_verificacion
     or new.sancion_hasta is distinct from old.sancion_hasta
     or new.salt is distinct from old.salt
     or new.legacy_password_hash is distinct from old.legacy_password_hash
     or new.needs_legacy_migration is distinct from old.needs_legacy_migration
  then
    raise exception using
      errcode = '42501',
      message = 'No autorizado: los campos protegidos de usuarios solo pueden modificarse mediante operaciones administrativas o internas.';
  end if;

  return new;
end;
$function$;
