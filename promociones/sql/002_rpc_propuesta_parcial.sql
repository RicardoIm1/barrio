-- PROPUESTA RPC COMERCIALES. NO EJECUTAR EN PRODUCCION.
-- Depende de promociones/sql/001_esquema_base_propuesta.sql.
-- Rama: feature/promociones-aprobadas
--
-- Alcance de esta entrega:
--   * Solicitar promoción.
--   * Reenviar solicitud que requiere ajustes.
--   * Cancelar solicitud por el propietario.
--   * Revisar solicitud por administrador.
--   * Activar promoción tras pago verificado.
--   * Vencer promociones mediante ejecución programada.
--
-- No incluye todavía reservas/carga/validación de comprobantes ni revisión
-- de pagos. Esas operaciones requieren cerrar el contrato de Storage privado
-- y el mecanismo de autenticación servidor para la Edge Function.
--
-- No modifica public.avisos, sus flags, triggers, admin.html, js/admin.js,
-- campanas_destacado ni el bucket media.
--
-- Requisitos previos:
--   1. Ejecutar y validar el esquema base en una base aislada.
--   2. Confirmar que private.es_admin() existe y valida admin activo.
--   3. Confirmar que el propietario de estas funciones será un rol confiable
--      con permisos sobre las seis tablas comerciales.
--
-- Las funciones SECURITY DEFINER se exponen solo a authenticated y validan
-- auth.uid() o private.es_admin() en el cuerpo. search_path queda vacío.

begin;

-- ---------------------------------------------------------------------
-- 1. Solicitar una promoción
-- ---------------------------------------------------------------------

create function public.solicitar_promocion(
  p_aviso_id uuid,
  p_productos uuid[],
  p_nota text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_aviso public.avisos%rowtype;
  v_solicitud_id uuid;
  v_total integer;
  v_cantidad integer;
  v_distintos integer;
  v_tipos integer;
  v_producto record;
begin
  if v_uid is null then
    raise exception 'Se requiere una sesión autenticada' using errcode = '28000';
  end if;

  if p_aviso_id is null
     or p_productos is null
     or cardinality(p_productos) not between 1 and 2
     or array_position(p_productos, null) is not null then
    raise exception 'Selecciona uno o dos productos válidos' using errcode = '22023';
  end if;

  select a.*
    into v_aviso
    from public.avisos as a
   where a.id = p_aviso_id
   for update;

  if not found then
    raise exception 'El aviso no existe' using errcode = 'P0002';
  end if;

  if v_aviso.created_by is distinct from v_uid then
    raise exception 'No puedes contratar promociones para este aviso' using errcode = '42501';
  end if;

  if v_aviso.status is distinct from 'activo' then
    raise exception 'El aviso debe estar activo para solicitar una promoción' using errcode = '22023';
  end if;

  select count(*), count(distinct x)
    into v_cantidad, v_distintos
    from unnest(p_productos) as x;

  if v_cantidad <> cardinality(p_productos) or v_distintos <> cardinality(p_productos) then
    raise exception 'No se permiten productos repetidos' using errcode = '22023';
  end if;

  select count(distinct p.tipo)
    into v_tipos
    from public.promocion_productos as p
   where p.id = any(p_productos)
     and p.activo
     and (p.vigente_desde is null or p.vigente_desde <= now())
     and (p.vigente_hasta is null or p.vigente_hasta > now());

  if v_tipos <> cardinality(p_productos) then
    raise exception 'Uno o más productos no están disponibles o repiten tipo' using errcode = '22023';
  end if;

  select coalesce(sum(p.precio_centavos), 0)
    into v_total
    from public.promocion_productos as p
   where p.id = any(p_productos)
     and p.activo
     and (p.vigente_desde is null or p.vigente_desde <= now())
     and (p.vigente_hasta is null or p.vigente_hasta > now());

  if v_total <= 0 then
    raise exception 'No fue posible calcular el importe de la solicitud' using errcode = '22023';
  end if;

  if exists (
    select 1
      from public.promocion_productos as p
      join public.promociones_activas as pa
        on pa.aviso_id = p_aviso_id
       and pa.tipo = p.tipo
     where p.id = any(p_productos)
       and pa.estado in ('programada', 'activa')
       and pa.vence_at > now()
  ) then
    raise exception 'El aviso ya tiene una promoción vigente de ese tipo' using errcode = '23505';
  end if;

  insert into public.solicitudes_promocion
    (aviso_id, solicitante_id, estado, total_centavos, moneda, nota_solicitante)
  values
    (p_aviso_id, v_uid, 'pendiente_revision', v_total, 'MXN', nullif(btrim(p_nota), ''))
  returning id into v_solicitud_id;

  insert into public.solicitud_promocion_items
    (solicitud_id, producto_id, tipo_snapshot, nombre_snapshot,
     precio_centavos_snapshot, moneda_snapshot, duracion_dias_snapshot)
  select v_solicitud_id, p.id, p.tipo, p.nombre,
         p.precio_centavos, p.moneda, p.duracion_dias
    from public.promocion_productos as p
   where p.id = any(p_productos)
     and p.activo
     and (p.vigente_desde is null or p.vigente_desde <= now())
     and (p.vigente_hasta is null or p.vigente_hasta > now())
   order by p.tipo;

  insert into public.eventos_promocion
    (solicitud_id, actor_id, actor_tipo, evento, estado_nuevo, detalle)
  values
    (v_solicitud_id, v_uid, 'usuario', 'solicitud_creada',
     'pendiente_revision',
     jsonb_build_object('total_centavos', v_total, 'moneda', 'MXN',
                        'componentes', cardinality(p_productos)));

  return jsonb_build_object(
    'solicitud_id', v_solicitud_id,
    'estado', 'pendiente_revision',
    'total_centavos', v_total,
    'moneda', 'MXN'
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Reenviar solicitud con ajustes atendidos
-- ---------------------------------------------------------------------

create function public.reenviar_solicitud_promocion(
  p_solicitud_id uuid,
  p_nota text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_solicitud public.solicitudes_promocion%rowtype;
begin
  if v_uid is null then
    raise exception 'Se requiere una sesión autenticada' using errcode = '28000';
  end if;

  select s.*
    into v_solicitud
    from public.solicitudes_promocion as s
   where s.id = p_solicitud_id
   for update;

  if not found or v_solicitud.solicitante_id is distinct from v_uid then
    raise exception 'Solicitud no encontrada' using errcode = 'P0002';
  end if;

  if v_solicitud.estado <> 'requiere_ajustes' then
    raise exception 'La solicitud no admite reenvío en su estado actual' using errcode = '22023';
  end if;

  update public.solicitudes_promocion
     set estado = 'pendiente_revision',
         nota_solicitante = coalesce(nullif(btrim(p_nota), ''), nota_solicitante),
         updated_at = now()
   where id = p_solicitud_id;

  insert into public.eventos_promocion
    (solicitud_id, actor_id, actor_tipo, evento, estado_anterior, estado_nuevo, detalle)
  values
    (p_solicitud_id, v_uid, 'usuario', 'solicitud_reenviada',
     'requiere_ajustes', 'pendiente_revision', '{}'::jsonb);

  return jsonb_build_object('solicitud_id', p_solicitud_id, 'estado', 'pendiente_revision');
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Cancelación voluntaria del propietario
-- ---------------------------------------------------------------------

create function public.cancelar_solicitud_promocion(
  p_solicitud_id uuid,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_solicitud public.solicitudes_promocion%rowtype;
begin
  if v_uid is null then
    raise exception 'Se requiere una sesión autenticada' using errcode = '28000';
  end if;

  if nullif(btrim(p_motivo), '') is null then
    raise exception 'Indica el motivo de cancelación' using errcode = '22023';
  end if;

  select s.*
    into v_solicitud
    from public.solicitudes_promocion as s
   where s.id = p_solicitud_id
   for update;

  if not found or v_solicitud.solicitante_id is distinct from v_uid then
    raise exception 'Solicitud no encontrada' using errcode = 'P0002';
  end if;

  if v_solicitud.estado not in ('pendiente_revision', 'requiere_ajustes') then
    raise exception 'La solicitud ya no admite cancelación por el usuario' using errcode = '22023';
  end if;

  update public.solicitudes_promocion
     set estado = 'cancelada',
         cancelled_at = now(),
         cancelled_by = v_uid,
         cancellation_reason = left(btrim(p_motivo), 1000),
         updated_at = now()
   where id = p_solicitud_id;

  insert into public.eventos_promocion
    (solicitud_id, actor_id, actor_tipo, evento, estado_anterior, estado_nuevo, detalle)
  values
    (p_solicitud_id, v_uid, 'usuario', 'solicitud_cancelada',
     v_solicitud.estado, 'cancelada',
     jsonb_build_object('motivo', left(btrim(p_motivo), 1000)));

  return jsonb_build_object('solicitud_id', p_solicitud_id, 'estado', 'cancelada');
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Revisión administrativa de la solicitud
-- ---------------------------------------------------------------------

create function public.revisar_solicitud_promocion(
  p_solicitud_id uuid,
  p_decision text,
  p_nota text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_solicitud public.solicitudes_promocion%rowtype;
  v_nuevo_estado text;
begin
  if v_uid is null or not private.es_admin() then
    raise exception 'Se requiere administrador activo' using errcode = '42501';
  end if;

  if p_decision not in ('aprobar', 'solicitar_ajustes', 'rechazar') then
    raise exception 'Decisión administrativa no válida' using errcode = '22023';
  end if;

  select s.*
    into v_solicitud
    from public.solicitudes_promocion as s
   where s.id = p_solicitud_id
   for update;

  if not found then
    raise exception 'Solicitud no encontrada' using errcode = 'P0002';
  end if;

  if p_decision in ('aprobar', 'solicitar_ajustes')
     and v_solicitud.estado <> 'pendiente_revision' then
    raise exception 'La solicitud ya no admite esa decisión' using errcode = '22023';
  end if;

  if p_decision = 'rechazar'
     and v_solicitud.estado not in ('pendiente_revision', 'requiere_ajustes') then
    raise exception 'La solicitud ya no admite rechazo' using errcode = '22023';
  end if;

  v_nuevo_estado := case p_decision
    when 'aprobar' then 'aprobada_pendiente_pago'
    when 'solicitar_ajustes' then 'requiere_ajustes'
    else 'rechazada'
  end;

  update public.solicitudes_promocion
     set estado = v_nuevo_estado,
         nota_admin = nullif(btrim(p_nota), ''),
         reviewed_at = now(),
         reviewed_by = v_uid,
         updated_at = now()
   where id = p_solicitud_id;

  insert into public.eventos_promocion
    (solicitud_id, actor_id, actor_tipo, evento, estado_anterior, estado_nuevo, detalle)
  values
    (p_solicitud_id, v_uid, 'admin', 'solicitud_' || p_decision,
     v_solicitud.estado, v_nuevo_estado,
     jsonb_build_object('nota', nullif(btrim(p_nota), '')));

  return jsonb_build_object('solicitud_id', p_solicitud_id, 'estado', v_nuevo_estado);
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Activación administrativa después de verificar el pago
-- ---------------------------------------------------------------------

create function public.activar_promocion(p_solicitud_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_aviso_id uuid;
  v_aviso public.avisos%rowtype;
  v_solicitud public.solicitudes_promocion%rowtype;
  v_pago public.pagos_promocion%rowtype;
  v_item record;
  v_activada_at timestamptz := now();
  v_creadas integer := 0;
  v_estado_anterior text;
begin
  if v_uid is null or not private.es_admin() then
    raise exception 'Se requiere administrador activo' using errcode = '42501';
  end if;

  -- Lectura preliminar sin lock. El orden global es aviso -> solicitud.
  select s.aviso_id
    into v_aviso_id
    from public.solicitudes_promocion as s
   where s.id = p_solicitud_id;

  if not found then
    raise exception 'Solicitud no encontrada' using errcode = 'P0002';
  end if;

  select a.*
    into v_aviso
    from public.avisos as a
   where a.id = v_aviso_id
   for update;

  if not found then
    raise exception 'El aviso asociado ya no existe' using errcode = 'P0002';
  end if;

  select s.*
    into v_solicitud
    from public.solicitudes_promocion as s
   where s.id = p_solicitud_id
   for update;

  if not found or v_solicitud.aviso_id is distinct from v_aviso_id then
    raise exception 'La relación de solicitud y aviso cambió; vuelve a intentar' using errcode = '40001';
  end if;

  if v_solicitud.estado <> 'pago_verificado' then
    raise exception 'La solicitud no tiene un pago verificado' using errcode = '22023';
  end if;

  select p.*
    into v_pago
    from public.pagos_promocion as p
   where p.solicitud_id = p_solicitud_id
     and p.estado_pago = 'verificado'
   for update;

  if not found or v_pago.importe_centavos_reportado <> v_solicitud.total_centavos
     or v_pago.moneda <> v_solicitud.moneda
     or v_pago.estado_carga <> 'validado' then
    raise exception 'No existe un pago verificado válido por el importe exacto' using errcode = '22023';
  end if;

  if v_aviso.status is distinct from 'activo' then
    update public.solicitudes_promocion
       set estado = 'revision_administrativa',
           updated_at = now()
     where id = p_solicitud_id;

    insert into public.eventos_promocion
      (solicitud_id, pago_id, actor_id, actor_tipo, evento,
       estado_anterior, estado_nuevo, detalle)
    values
      (p_solicitud_id, v_pago.id, v_uid, 'admin',
       'activacion_bloqueada_aviso_inactivo',
       'pago_verificado', 'revision_administrativa',
       jsonb_build_object('aviso_status', v_aviso.status));

    return jsonb_build_object(
      'solicitud_id', p_solicitud_id,
      'estado', 'revision_administrativa',
      'activada', false
    );
  end if;

  -- El reloj no actualiza estados: marcar caducadas antes de insertar
  -- para que el índice único parcial libere el tipo correspondiente.
  update public.promociones_activas as pa
     set estado = 'vencida',
         updated_at = now()
   where pa.aviso_id = v_aviso_id
     and pa.estado in ('programada', 'activa')
     and pa.vence_at <= v_activada_at;

  if exists (
    select 1
      from public.promociones_activas as pa
      join public.solicitud_promocion_items as i
        on i.solicitud_id = p_solicitud_id
       and i.tipo_snapshot = pa.tipo
     where pa.aviso_id = v_aviso_id
       and pa.estado in ('programada', 'activa')
       and pa.vence_at > v_activada_at
  ) then
    raise exception 'Ya existe una promoción vigente del mismo tipo para este aviso' using errcode = '23505';
  end if;

  for v_item in
    select i.*
      from public.solicitud_promocion_items as i
     where i.solicitud_id = p_solicitud_id
     order by i.tipo_snapshot, i.id
  loop
    insert into public.promociones_activas
      (solicitud_item_id, solicitud_id, aviso_id, tipo, estado,
       activada_at, vence_at, activada_por)
    values
      (v_item.id, p_solicitud_id, v_aviso_id, v_item.tipo_snapshot, 'activa',
       v_activada_at,
       v_activada_at + make_interval(days => v_item.duracion_dias_snapshot),
       v_uid);

    v_creadas := v_creadas + 1;
  end loop;

  if v_creadas = 0 then
    raise exception 'La solicitud no contiene componentes contratados' using errcode = '22023';
  end if;

  update public.pagos_promocion
     set comprobante_eliminar_despues_de = v_activada_at + interval '7 days',
         updated_at = now()
   where id = v_pago.id;

  update public.solicitudes_promocion
     set estado = 'activa',
         updated_at = now()
   where id = p_solicitud_id;

  insert into public.eventos_promocion
    (solicitud_id, pago_id, actor_id, actor_tipo, evento,
     estado_anterior, estado_nuevo, detalle)
  values
    (p_solicitud_id, v_pago.id, v_uid, 'admin', 'promocion_activada',
     'pago_verificado', 'activa',
     jsonb_build_object('componentes_activados', v_creadas,
                        'activada_at', v_activada_at));

  return jsonb_build_object(
    'solicitud_id', p_solicitud_id,
    'estado', 'activa',
    'activada', true,
    'componentes', v_creadas,
    'activada_at', v_activada_at
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Vencimiento idempotente para ejecución de sistema
-- ---------------------------------------------------------------------

create function public.vencer_promociones()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_promocion record;
  v_promociones_vencidas integer := 0;
  v_solicitudes_vencidas integer := 0;
begin
  -- Impide dos ejecuciones simultáneas del mismo proceso de vencimiento.
  if not pg_catalog.pg_try_advisory_xact_lock(73110420261::bigint) then
    return jsonb_build_object('omitido', true, 'motivo', 'ejecucion_en_curso');
  end if;

  for v_promocion in
    select pa.id, pa.solicitud_id, pa.tipo
      from public.promociones_activas as pa
     where pa.estado = 'activa'
       and pa.vence_at <= now()
     order by pa.vence_at, pa.id
     for update
  loop
    update public.promociones_activas
       set estado = 'vencida',
           updated_at = now()
     where id = v_promocion.id
       and estado = 'activa';

    if found then
      insert into public.eventos_promocion
        (solicitud_id, promocion_id, actor_tipo, evento,
         estado_anterior, estado_nuevo, detalle)
      values
        (v_promocion.solicitud_id, v_promocion.id, 'sistema',
         'componente_vencido', 'activa', 'vencida',
         jsonb_build_object('tipo', v_promocion.tipo));

      v_promociones_vencidas := v_promociones_vencidas + 1;
    end if;
  end loop;

  with candidatas as (
    select s.id
      from public.solicitudes_promocion as s
     where s.estado = 'activa'
       and exists (
         select 1
           from public.solicitud_promocion_items as i
          where i.solicitud_id = s.id
       )
       and not exists (
         select 1
           from public.solicitud_promocion_items as i
          where i.solicitud_id = s.id
            and not exists (
              select 1
                from public.promociones_activas as pa
               where pa.solicitud_item_id = i.id
                 and pa.estado = 'vencida'
            )
       )
     order by s.id
     for update
  ),
  actualizadas as (
    update public.solicitudes_promocion as s
       set estado = 'vencida',
           updated_at = now()
      from candidatas as c
     where s.id = c.id
       and s.estado = 'activa'
    returning s.id
  )
  insert into public.eventos_promocion
    (solicitud_id, actor_tipo, evento, estado_anterior, estado_nuevo, detalle)
  select a.id, 'sistema', 'solicitud_vencida', 'activa', 'vencida',
         jsonb_build_object('motivo', 'todos_los_componentes_vencidos')
    from actualizadas as a;

  get diagnostics v_solicitudes_vencidas = row_count;

  return jsonb_build_object(
    'promociones_vencidas', v_promociones_vencidas,
    'solicitudes_vencidas', v_solicitudes_vencidas,
    'omitido', false
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Privilegios de ejecución explícitos
-- ---------------------------------------------------------------------

revoke all on function public.solicitar_promocion(uuid, uuid[], text)
  from public, anon, authenticated, service_role;
revoke all on function public.reenviar_solicitud_promocion(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.cancelar_solicitud_promocion(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.revisar_solicitud_promocion(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.activar_promocion(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.vencer_promociones()
  from public, anon, authenticated, service_role;

grant execute on function public.solicitar_promocion(uuid, uuid[], text)
  to authenticated;
grant execute on function public.reenviar_solicitud_promocion(uuid, text)
  to authenticated;
grant execute on function public.cancelar_solicitud_promocion(uuid, text)
  to authenticated;
grant execute on function public.revisar_solicitud_promocion(uuid, text, text)
  to authenticated;
grant execute on function public.activar_promocion(uuid)
  to authenticated;

-- vencer_promociones() queda solo para ejecución confiable del propietario
-- o del mecanismo programado configurado expresamente en una etapa posterior.

commit;

-- FIN: esta propuesta no ha sido ejecutada ni validada por PostgreSQL.
