-- PROPUESTA: retención, suspensión y limpieza de comprobantes.
-- NO EJECUTAR EN PRODUCCION.
-- Depende de 001, 002 y 003 del módulo de promociones.
--
-- La Edge Function limpiar-comprobantes-promocion llama las RPC exclusivas
-- de service_role y elimina objetos por Supabase Storage API.
-- Este SQL nunca borra filas ni objetos de storage.objects.
--
-- Orden de locks administrativos: aviso -> solicitud -> pago.

begin;

-- ---------------------------------------------------------------------
-- 1. Suspender retención por controversia, incidencia o revisión pendiente
-- ---------------------------------------------------------------------

create function public.suspender_retencion_comprobante(
  p_pago_id uuid,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_solicitud_id uuid;
  v_aviso_id uuid;
  v_pago public.pagos_promocion%rowtype;
begin
  if v_uid is null or not private.es_admin() then
    raise exception 'Se requiere administrador activo' using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Indica el motivo de suspensión' using errcode = '22023';
  end if;

  select p.solicitud_id, s.aviso_id
    into v_solicitud_id, v_aviso_id
    from public.pagos_promocion as p
    join public.solicitudes_promocion as s on s.id = p.solicitud_id
   where p.id = p_pago_id;

  if not found then
    raise exception 'Pago no encontrado' using errcode = 'P0002';
  end if;

  perform 1 from public.avisos as a where a.id = v_aviso_id for update;
  perform 1 from public.solicitudes_promocion as s where s.id = v_solicitud_id for update;

  select p.*
    into v_pago
    from public.pagos_promocion as p
   where p.id = p_pago_id
   for update;

  if v_pago.comprobante_eliminado_at is not null then
    raise exception 'El comprobante ya fue eliminado' using errcode = '22023';
  end if;

  -- La reclamación de limpieza actúa como una ventana breve de exclusión:
  -- no se permite suspender mientras Storage API procesa el objeto.
  if v_pago.ultimo_intento_borrado_at > now() - interval '15 minutes' then
    raise exception 'La limpieza de este comprobante está en curso; vuelve a intentar en unos minutos' using errcode = '55P03';
  end if;

  if v_pago.retencion_suspendida then
    return jsonb_build_object('pago_id', p_pago_id, 'retencion_suspendida', true, 'idempotente', true);
  end if;

  update public.pagos_promocion
     set retencion_suspendida = true,
         retencion_motivo = left(btrim(p_motivo), 1000),
         retencion_liberada_at = null,
         retencion_liberada_por = null,
         updated_at = now()
   where id = p_pago_id;

  insert into public.eventos_promocion
    (solicitud_id, pago_id, actor_id, actor_tipo, evento, detalle)
  values
    (v_solicitud_id, p_pago_id, v_uid, 'admin',
     'retencion_comprobante_suspendida',
     jsonb_build_object('motivo', left(btrim(p_motivo), 1000)));

  return jsonb_build_object('pago_id', p_pago_id, 'retencion_suspendida', true);
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Liberar retención. Si ya venció, el siguiente ciclo puede eliminar.
-- ---------------------------------------------------------------------

create function public.liberar_retencion_comprobante(
  p_pago_id uuid,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_solicitud_id uuid;
  v_aviso_id uuid;
  v_pago public.pagos_promocion%rowtype;
begin
  if v_uid is null or not private.es_admin() then
    raise exception 'Se requiere administrador activo' using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Indica el motivo de liberación' using errcode = '22023';
  end if;

  select p.solicitud_id, s.aviso_id
    into v_solicitud_id, v_aviso_id
    from public.pagos_promocion as p
    join public.solicitudes_promocion as s on s.id = p.solicitud_id
   where p.id = p_pago_id;

  if not found then
    raise exception 'Pago no encontrado' using errcode = 'P0002';
  end if;

  perform 1 from public.avisos as a where a.id = v_aviso_id for update;
  perform 1 from public.solicitudes_promocion as s where s.id = v_solicitud_id for update;

  select p.*
    into v_pago
    from public.pagos_promocion as p
   where p.id = p_pago_id
   for update;

  if v_pago.comprobante_eliminado_at is not null then
    raise exception 'El comprobante ya fue eliminado' using errcode = '22023';
  end if;

  if not v_pago.retencion_suspendida then
    return jsonb_build_object('pago_id', p_pago_id, 'retencion_suspendida', false, 'idempotente', true);
  end if;

  update public.pagos_promocion
     set retencion_suspendida = false,
         retencion_motivo = null,
         retencion_liberada_at = now(),
         retencion_liberada_por = v_uid,
         updated_at = now()
   where id = p_pago_id;

  insert into public.eventos_promocion
    (solicitud_id, pago_id, actor_id, actor_tipo, evento, detalle)
  values
    (v_solicitud_id, p_pago_id, v_uid, 'admin',
     'retencion_comprobante_liberada',
     jsonb_build_object('motivo', left(btrim(p_motivo), 1000)));

  return jsonb_build_object(
    'pago_id', p_pago_id,
    'retencion_suspendida', false,
    'elegible_en_siguiente_ciclo',
      v_pago.comprobante_eliminar_despues_de is not null
      and v_pago.comprobante_eliminar_despues_de <= now()
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Reclamar objetos elegibles. Solo service_role.
-- ---------------------------------------------------------------------

create function public.reclamar_comprobantes_para_limpieza(p_limit integer default 100)
returns table(pago_id uuid, path text, motivo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 200));
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Operación exclusiva del proceso de limpieza' using errcode = '42501';
  end if;

  return query
  with reservas_vencidas as (
    update public.pagos_promocion as p
       set estado_carga = 'expirada',
           updated_at = now()
     where p.estado_pago = 'pendiente'
       and p.estado_carga in ('pendiente_carga', 'error', 'validando')
       and p.reserva_expira_at <= now()
       and not p.retencion_suspendida
       and (p.estado_carga <> 'validando'
            or p.updated_at <= now() - interval '5 minutes')
    returning p.id, p.solicitud_id
  ),
  eventos_expiracion as (
    insert into public.eventos_promocion
      (solicitud_id, pago_id, actor_tipo, evento, estado_nuevo, detalle)
    select r.solicitud_id, r.id, 'sistema', 'reserva_comprobante_expirada',
           'expirada', jsonb_build_object('motivo', 'reserva_caducada')
      from reservas_vencidas as r
    returning id
  ),
  candidatas as (
    select p.id
      from public.pagos_promocion as p
     where p.comprobante_eliminado_at is null
       and not p.retencion_suspendida
       and (
         p.estado_carga = 'invalido'
         or (
           p.estado_carga = 'expirada'
           and p.reserva_expira_at <= now()
         )
         or (
           p.comprobante_eliminar_despues_de is not null
           and p.comprobante_eliminar_despues_de <= now()
         )
       )
       and (
         p.ultimo_intento_borrado_at is null
         or p.ultimo_intento_borrado_at <= now() - interval '20 hours'
       )
    union
    -- Los CTE de escritura comparten snapshot; incluir explícitamente las
    -- reservas recién expiradas para limpiarlas en este mismo ciclo.
    select rv.id
      from reservas_vencidas as rv
     where not exists (
       select 1
         from public.pagos_promocion as p2
        where p2.id = rv.id
          and (p2.retencion_suspendida
               or p2.ultimo_intento_borrado_at > now() - interval '20 hours')
     )
  ),
  candidatas_ordenadas as (
    select p.id,
           coalesce(p.comprobante_eliminar_despues_de, p.reserva_expira_at) as fecha_orden
      from public.pagos_promocion as p
      join candidatas as c on c.id = p.id
     order by fecha_orden, p.id
     for update of p skip locked
     limit v_limit
  ),
  reclamadas as (
    update public.pagos_promocion as p
       set ultimo_intento_borrado_at = now(),
           updated_at = now()
      from candidatas_ordenadas as c
     where p.id = c.id
    returning
      p.id,
      p.comprobante_path,
      case
        when p.estado_carga = 'invalido' then 'archivo_invalido'
        when p.estado_carga = 'expirada' then 'reserva_expirada'
        else 'retencion_vencida'
      end as motivo
  )
  select r.id, r.comprobante_path, r.motivo
    from reclamadas as r;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Registrar resultado de Storage API. Solo service_role.
-- ---------------------------------------------------------------------

create function public.registrar_borrado_comprobante(
  p_pago_id uuid,
  p_exito boolean,
  p_codigo_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_solicitud_id uuid;
  v_pago public.pagos_promocion%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Operación exclusiva del proceso de limpieza' using errcode = '42501';
  end if;

  if p_exito is null then
    raise exception 'Resultado de borrado requerido' using errcode = '22023';
  end if;

  if p_codigo_error is not null and p_codigo_error !~ '^[a-z0-9_]{1,60}$' then
    raise exception 'Código de error no válido' using errcode = '22023';
  end if;

  select p.*
    into v_pago
    from public.pagos_promocion as p
   where p.id = p_pago_id
   for update;

  if not found then
    raise exception 'Pago no encontrado' using errcode = 'P0002';
  end if;

  v_solicitud_id := v_pago.solicitud_id;

  if p_exito then
    if v_pago.comprobante_eliminado_at is not null then
      return jsonb_build_object('pago_id', p_pago_id, 'eliminado', true, 'idempotente', true);
    end if;

    update public.pagos_promocion
       set comprobante_eliminado_at = now(),
           ultimo_error_borrado = null,
           updated_at = now()
     where id = p_pago_id;

    insert into public.eventos_promocion
      (solicitud_id, pago_id, actor_tipo, evento, detalle)
    values
      (v_solicitud_id, p_pago_id, 'sistema', 'comprobante_eliminado',
       jsonb_build_object('via', 'storage_api'));
  else
    update public.pagos_promocion
       set ultimo_error_borrado = coalesce(p_codigo_error, 'storage_remove_failed'),
           updated_at = now()
     where id = p_pago_id;

    insert into public.eventos_promocion
      (solicitud_id, pago_id, actor_tipo, evento, detalle)
    values
      (v_solicitud_id, p_pago_id, 'sistema', 'error_borrado_comprobante',
       jsonb_build_object('codigo', coalesce(p_codigo_error, 'storage_remove_failed')));
  end if;

  return jsonb_build_object(
    'pago_id', p_pago_id,
    'eliminado', p_exito,
    'idempotente', false
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Privilegios explícitos
-- ---------------------------------------------------------------------

revoke all on function public.suspender_retencion_comprobante(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.liberar_retencion_comprobante(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.reclamar_comprobantes_para_limpieza(integer)
  from public, anon, authenticated, service_role;
revoke all on function public.registrar_borrado_comprobante(uuid, boolean, text)
  from public, anon, authenticated, service_role;

grant execute on function public.suspender_retencion_comprobante(uuid, text)
  to authenticated;
grant execute on function public.liberar_retencion_comprobante(uuid, text)
  to authenticated;
grant execute on function public.reclamar_comprobantes_para_limpieza(integer)
  to service_role;
grant execute on function public.registrar_borrado_comprobante(uuid, boolean, text)
  to service_role;

commit;

-- FIN: propuesta documental. No ejecutada ni validada por PostgreSQL.
