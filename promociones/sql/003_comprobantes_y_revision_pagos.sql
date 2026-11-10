-- PROPUESTA: ciclo de comprobantes y revisión de pagos.
-- NO EJECUTAR EN PRODUCCION.
-- Depende de 001_esquema_base_propuesta.sql y 002_rpc_propuesta_parcial.sql.
-- No crea el bucket. El bucket privado se crea por Dashboard antes de aplicar
-- la policy de INSERT. No modifica bucket media ni policies existentes.
--
-- Contrato:
--   1) Usuario autenticado reserva un intento con reservar_comprobante_promocion.
--   2) Sube exactamente un objeto nuevo a comprobantes-promociones, upsert=false.
--   3) Invoca Edge Function comprobantes-promocion {accion:"validar"}.
--   4) La Edge Function autentica al usuario, reclama validación, descarga el
--      objeto con service role, inspecciona bytes y calcula SHA-256.
--   5) Solo service_role puede finalizar validación.
--   6) Admin revisa pago mediante revisar_pago_promocion.
--   7) Admin obtiene URL temporal a través de la Edge Function, nunca directa.
--
-- Ninguna función modifica public.avisos ni sus flags.

begin;

-- ---------------------------------------------------------------------
-- 1. Reserva segura de un intento de pago y ruta de carga
-- ---------------------------------------------------------------------

create function public.reservar_comprobante_promocion(
  p_solicitud_id uuid,
  p_importe_centavos integer,
  p_referencia text,
  p_mime_declarado text
)
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
  v_pago_id uuid := gen_random_uuid();
  v_extension text;
  v_path text;
  v_referencia text := nullif(left(btrim(coalesce(p_referencia, '')), 120), '');
  v_mime text := lower(btrim(coalesce(p_mime_declarado, '')));
  v_expira timestamptz := now() + interval '30 minutes';
begin
  if v_uid is null then
    raise exception 'Se requiere una sesión autenticada' using errcode = '28000';
  end if;

  if p_solicitud_id is null or p_importe_centavos is null or p_importe_centavos <= 0 then
    raise exception 'Datos de pago incompletos' using errcode = '22023';
  end if;

  v_extension := case v_mime
    when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png'
    when 'image/webp' then 'webp'
    when 'application/pdf' then 'pdf'
    else null
  end;

  if v_extension is null then
    raise exception 'Formato de comprobante no permitido' using errcode = '22023';
  end if;

  -- Orden global de locks: aviso -> solicitud -> pago.
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
    raise exception 'Aviso no encontrado' using errcode = 'P0002';
  end if;

  select s.*
    into v_solicitud
    from public.solicitudes_promocion as s
   where s.id = p_solicitud_id
   for update;

  if v_solicitud.solicitante_id is distinct from v_uid then
    raise exception 'No puedes reportar pagos de esta solicitud' using errcode = '42501';
  end if;

  if v_solicitud.estado not in ('aprobada_pendiente_pago', 'pago_observado') then
    raise exception 'La solicitud no está habilitada para reportar un pago' using errcode = '22023';
  end if;

  if v_aviso.status is distinct from 'activo' then
    raise exception 'El aviso ya no está activo; contacta al administrador' using errcode = '22023';
  end if;

  if p_importe_centavos <> v_solicitud.total_centavos then
    raise exception 'El importe debe coincidir con el total autorizado' using errcode = '22023';
  end if;

  -- Cerrar reservas abandonadas anteriores. Sus objetos, si existen, se
  -- eliminan por la Edge Function de limpieza, nunca mediante SQL.
  update public.pagos_promocion
     set estado_carga = 'expirada',
         updated_at = now()
   where solicitud_id = p_solicitud_id
     and estado_pago = 'pendiente'
     and estado_carga in ('pendiente_carga', 'error')
     and reserva_expira_at <= now();

  if exists (
    select 1
      from public.pagos_promocion as p
     where p.solicitud_id = p_solicitud_id
       and p.estado_pago = 'pendiente'
       and p.estado_carga in ('pendiente_carga', 'validando')
       and p.reserva_expira_at > now()
  ) then
    raise exception 'Ya existe un intento de carga vigente para esta solicitud' using errcode = '23505';
  end if;

  v_path := v_uid::text || '/' || p_solicitud_id::text || '/' ||
            v_pago_id::text || '.' || v_extension;

  insert into public.pagos_promocion
    (id, solicitud_id, reportado_por, importe_centavos_reportado, moneda,
     estado_pago, estado_carga, comprobante_path, mime_declarado,
     referencia_operacion, reservado_at, reserva_expira_at)
  values
    (v_pago_id, p_solicitud_id, v_uid, p_importe_centavos, v_solicitud.moneda,
     'pendiente', 'pendiente_carga', v_path, v_mime,
     v_referencia, now(), v_expira);

  insert into public.eventos_promocion
    (solicitud_id, pago_id, actor_id, actor_tipo, evento,
     estado_anterior, estado_nuevo, detalle)
  values
    (p_solicitud_id, v_pago_id, v_uid, 'usuario', 'comprobante_reservado',
     v_solicitud.estado, v_solicitud.estado,
     jsonb_build_object('mime_declarado', v_mime,
                        'reserva_expira_at', v_expira));

  return jsonb_build_object(
    'pago_id', v_pago_id,
    'bucket', 'comprobantes-promociones',
    'path', v_path,
    'mime_declarado', v_mime,
    'reserva_expira_at', v_expira,
    'upsert', false,
    'max_bytes', 5000000
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Reclamar validación. Solo propietario y reserva vigente.
-- ---------------------------------------------------------------------

create function public.iniciar_validacion_comprobante(p_pago_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_aviso_id uuid;
  v_solicitud_id uuid;
  v_aviso public.avisos%rowtype;
  v_solicitud public.solicitudes_promocion%rowtype;
  v_pago public.pagos_promocion%rowtype;
begin
  if v_uid is null then
    raise exception 'Se requiere una sesión autenticada' using errcode = '28000';
  end if;

  select p.solicitud_id, s.aviso_id
    into v_solicitud_id, v_aviso_id
    from public.pagos_promocion as p
    join public.solicitudes_promocion as s on s.id = p.solicitud_id
   where p.id = p_pago_id;

  if not found then
    raise exception 'Intento de pago no encontrado' using errcode = 'P0002';
  end if;

  select a.*
    into v_aviso
    from public.avisos as a
   where a.id = v_aviso_id
   for update;

  select s.*
    into v_solicitud
    from public.solicitudes_promocion as s
   where s.id = v_solicitud_id
   for update;

  select p.*
    into v_pago
    from public.pagos_promocion as p
   where p.id = p_pago_id
   for update;

  if v_pago.reportado_por is distinct from v_uid
     or v_solicitud.solicitante_id is distinct from v_uid then
    raise exception 'Intento de pago no encontrado' using errcode = 'P0002';
  end if;

  if v_pago.estado_carga = 'validado' and v_pago.estado_pago = 'reportado' then
    return jsonb_build_object('ya_validado', true, 'estado', 'reportado');
  end if;

  if v_pago.estado_pago <> 'pendiente'
     or v_pago.estado_carga not in ('pendiente_carga', 'error')
     or v_pago.reserva_expira_at <= now()
     or v_solicitud.estado not in ('aprobada_pendiente_pago', 'pago_observado') then
    raise exception 'La reserva expiró o ya no admite validación' using errcode = '22023';
  end if;

  update public.pagos_promocion
     set estado_carga = 'validando',
         cargado_at = coalesce(cargado_at, now()),
         updated_at = now()
   where id = p_pago_id;

  insert into public.eventos_promocion
    (solicitud_id, pago_id, actor_id, actor_tipo, evento, detalle)
  values
    (v_solicitud_id, p_pago_id, v_uid, 'usuario',
     'validacion_solicitada', '{}'::jsonb);

  return jsonb_build_object(
    'ya_validado', false,
    'pago_id', p_pago_id,
    'bucket', 'comprobantes-promociones',
    'path', v_pago.comprobante_path,
    'mime_declarado', v_pago.mime_declarado,
    'estado', 'validando'
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Finalizar validación. Exclusiva de la Edge Function con service role.
-- ---------------------------------------------------------------------

create function public.finalizar_validacion_comprobante(
  p_pago_id uuid,
  p_resultado text,
  p_mime_detectado text default null,
  p_bytes bigint default null,
  p_sha256 text default null,
  p_codigo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_solicitud_id uuid;
  v_aviso_id uuid;
  v_solicitud public.solicitudes_promocion%rowtype;
  v_pago public.pagos_promocion%rowtype;
  v_estado_carga text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Operación exclusiva del servicio de validación' using errcode = '42501';
  end if;

  if p_resultado not in ('valido', 'invalido', 'error') then
    raise exception 'Resultado de validación no permitido' using errcode = '22023';
  end if;

  if p_codigo is not null and p_codigo !~ '^[a-z0-9_]{1,60}$' then
    raise exception 'Código técnico no válido' using errcode = '22023';
  end if;

  select p.solicitud_id, s.aviso_id
    into v_solicitud_id, v_aviso_id
    from public.pagos_promocion as p
    join public.solicitudes_promocion as s on s.id = p.solicitud_id
   where p.id = p_pago_id;

  if not found then
    raise exception 'Intento de pago no encontrado' using errcode = 'P0002';
  end if;

  perform 1
    from public.avisos as a
   where a.id = v_aviso_id
   for update;

  select s.*
    into v_solicitud
    from public.solicitudes_promocion as s
   where s.id = v_solicitud_id
   for update;

  select p.*
    into v_pago
    from public.pagos_promocion as p
   where p.id = p_pago_id
   for update;

  if v_pago.estado_carga = 'validado' and v_pago.estado_pago = 'reportado' then
    return jsonb_build_object('idempotente', true, 'estado', 'reportado');
  end if;

  if v_pago.estado_carga <> 'validando' or v_pago.estado_pago <> 'pendiente' then
    raise exception 'El intento no está en validación' using errcode = '22023';
  end if;

  if p_resultado = 'valido' then
    if p_mime_detectado not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
       or p_bytes is null or p_bytes < 1 or p_bytes > 5000000
       or p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$'
       or p_mime_detectado is distinct from v_pago.mime_declarado then
      raise exception 'Metadatos de validación inconsistentes' using errcode = '22023';
    end if;

    if v_solicitud.estado not in ('aprobada_pendiente_pago', 'pago_observado') then
      raise exception 'La solicitud ya no admite reportar el pago' using errcode = '22023';
    end if;

    update public.pagos_promocion
       set estado_carga = 'validado',
           estado_pago = 'reportado',
           mime_detectado = p_mime_detectado,
           bytes_comprobante = p_bytes,
           sha256 = p_sha256,
           validado_at = now(),
           reportado_at = now(),
           updated_at = now()
     where id = p_pago_id;

    update public.solicitudes_promocion
       set estado = 'pago_reportado',
           updated_at = now()
     where id = v_solicitud_id;

    v_estado_carga := 'validado';
  elsif p_resultado = 'invalido' then
    update public.pagos_promocion
       set estado_carga = 'invalido',
           mime_detectado = null,
           bytes_comprobante = null,
           sha256 = null,
           updated_at = now()
     where id = p_pago_id;

    v_estado_carga := 'invalido';
  else
    update public.pagos_promocion
       set estado_carga = 'error',
           updated_at = now()
     where id = p_pago_id;

    v_estado_carga := 'error';
  end if;

  insert into public.eventos_promocion
    (solicitud_id, pago_id, actor_tipo, evento,
     estado_anterior, estado_nuevo, detalle)
  values
    (v_solicitud_id, p_pago_id, 'sistema',
     case p_resultado
       when 'valido' then 'comprobante_validado'
       when 'invalido' then 'comprobante_invalido'
       else 'error_validacion_comprobante'
     end,
     'pendiente_carga', v_estado_carga,
     jsonb_build_object('codigo', coalesce(p_codigo, 'sin_codigo'),
                        'bytes_observados', p_bytes));

  return jsonb_build_object('idempotente', false, 'estado_carga', v_estado_carga);
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Revisión administrativa del pago
-- ---------------------------------------------------------------------

create function public.revisar_pago_promocion(
  p_pago_id uuid,
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
  v_solicitud_id uuid;
  v_aviso_id uuid;
  v_aviso public.avisos%rowtype;
  v_solicitud public.solicitudes_promocion%rowtype;
  v_pago public.pagos_promocion%rowtype;
  v_estado_solicitud text;
begin
  if v_uid is null or not private.es_admin() then
    raise exception 'Se requiere administrador activo' using errcode = '42501';
  end if;

  if p_decision is null or p_decision not in ('verificar', 'observar', 'rechazar') then
    raise exception 'Decisión de pago no válida' using errcode = '22023';
  end if;

  if p_decision in ('observar', 'rechazar')
     and nullif(btrim(coalesce(p_nota, '')), '') is null then
    raise exception 'La observación o rechazo requiere un motivo' using errcode = '22023';
  end if;

  select p.solicitud_id, s.aviso_id
    into v_solicitud_id, v_aviso_id
    from public.pagos_promocion as p
    join public.solicitudes_promocion as s on s.id = p.solicitud_id
   where p.id = p_pago_id;

  if not found then
    raise exception 'Pago no encontrado' using errcode = 'P0002';
  end if;

  select a.*
    into v_aviso
    from public.avisos as a
   where a.id = v_aviso_id
   for update;

  select s.*
    into v_solicitud
    from public.solicitudes_promocion as s
   where s.id = v_solicitud_id
   for update;

  select p.*
    into v_pago
    from public.pagos_promocion as p
   where p.id = p_pago_id
   for update;

  if v_pago.estado_pago <> 'reportado'
     or v_pago.estado_carga <> 'validado'
     or v_solicitud.estado <> 'pago_reportado' then
    raise exception 'El comprobante aún no está disponible para revisión' using errcode = '22023';
  end if;

  if p_decision = 'verificar' and (
       v_pago.importe_centavos_reportado <> v_solicitud.total_centavos
       or v_pago.moneda <> v_solicitud.moneda
     ) then
    raise exception 'El importe reportado no coincide con el importe autorizado' using errcode = '22023';
  end if;

  if p_decision = 'verificar' then
    update public.pagos_promocion
       set estado_pago = 'verificado',
           revisado_at = now(),
           revisado_por = v_uid,
           observacion_admin = nullif(btrim(coalesce(p_nota, '')), ''),
           comprobante_eliminar_despues_de = null,
           updated_at = now()
     where id = p_pago_id;

    update public.solicitudes_promocion
       set estado = 'pago_verificado',
           updated_at = now()
     where id = v_solicitud_id;

    v_estado_solicitud := 'pago_verificado';
  elsif p_decision = 'observar' then
    update public.pagos_promocion
       set estado_pago = 'observado',
           revisado_at = now(),
           revisado_por = v_uid,
           observacion_admin = left(btrim(p_nota), 1000),
           comprobante_eliminar_despues_de = now() + interval '7 days',
           updated_at = now()
     where id = p_pago_id;

    update public.solicitudes_promocion
       set estado = 'pago_observado',
           updated_at = now()
     where id = v_solicitud_id;

    v_estado_solicitud := 'pago_observado';
  else
    update public.pagos_promocion
       set estado_pago = 'rechazado',
           revisado_at = now(),
           revisado_por = v_uid,
           observacion_admin = left(btrim(p_nota), 1000),
           comprobante_eliminar_despues_de = now() + interval '7 days',
           updated_at = now()
     where id = p_pago_id;

    -- El rechazo del comprobante no rechaza la solicitud comercial.
    -- El usuario puede reservar un nuevo intento, conservando el anterior.
    update public.solicitudes_promocion
       set estado = 'aprobada_pendiente_pago',
           updated_at = now()
     where id = v_solicitud_id;

    v_estado_solicitud := 'aprobada_pendiente_pago';
  end if;

  insert into public.eventos_promocion
    (solicitud_id, pago_id, actor_id, actor_tipo, evento,
     estado_anterior, estado_nuevo, detalle)
  values
    (v_solicitud_id, p_pago_id, v_uid, 'admin',
     'pago_' || p_decision,
     'reportado', case p_decision
       when 'verificar' then 'verificado'
       when 'observar' then 'observado'
       else 'rechazado'
     end,
     jsonb_build_object('nota', nullif(left(btrim(coalesce(p_nota, '')), 1000), '')));

  return jsonb_build_object(
    'pago_id', p_pago_id,
    'decision', p_decision,
    'estado_solicitud', v_estado_solicitud
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Obtener ruta para URL firmada. Solo administrador activo.
-- ---------------------------------------------------------------------

create function public.obtener_ruta_comprobante_admin(p_pago_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pago public.pagos_promocion%rowtype;
begin
  if v_uid is null or not private.es_admin() then
    raise exception 'Se requiere administrador activo' using errcode = '42501';
  end if;

  select p.*
    into v_pago
    from public.pagos_promocion as p
   where p.id = p_pago_id
   for update;

  if not found
     or v_pago.estado_carga <> 'validado'
     or v_pago.comprobante_eliminado_at is not null
     or v_pago.estado_pago not in ('reportado', 'observado', 'verificado', 'rechazado') then
    raise exception 'Comprobante no disponible para revisión' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'bucket', 'comprobantes-promociones',
    'path', v_pago.comprobante_path,
    'mime', v_pago.mime_detectado
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Autorización exacta de INSERT en Storage
-- ---------------------------------------------------------------------

create function private.puede_cargar_comprobante_promocion(
  p_bucket_id text,
  p_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and p_bucket_id = 'comprobantes-promociones'
    and exists (
      select 1
        from public.pagos_promocion as p
        join public.solicitudes_promocion as s
          on s.id = p.solicitud_id
        join public.avisos as a
          on a.id = s.aviso_id
       where p.comprobante_path = p_name
         and p.reportado_por = auth.uid()
         and s.solicitante_id = auth.uid()
         and s.estado in ('aprobada_pendiente_pago', 'pago_observado')
         and a.status = 'activo'
         and p.estado_pago = 'pendiente'
         and p.estado_carga = 'pendiente_carga'
         and p.reserva_expira_at > now()
    );
$$;

-- No se crea policy SELECT, UPDATE ni DELETE. La policy existente del bucket
-- media no coincide con el nuevo bucket; revisar policies actuales antes de
-- aplicar para evitar cualquier permiso PERMISSIVE adicional inesperado.
create policy promocion_comprobantes_insert_reserva
on storage.objects
for insert
to authenticated
with check (
  private.puede_cargar_comprobante_promocion(bucket_id, name)
);

-- ---------------------------------------------------------------------
-- 7. Privilegios explícitos
-- ---------------------------------------------------------------------

revoke all on function public.reservar_comprobante_promocion(uuid, integer, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.iniciar_validacion_comprobante(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.finalizar_validacion_comprobante(uuid, text, text, bigint, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.revisar_pago_promocion(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.obtener_ruta_comprobante_admin(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.puede_cargar_comprobante_promocion(text, text)
  from public, anon, authenticated, service_role;

grant execute on function public.reservar_comprobante_promocion(uuid, integer, text, text)
  to authenticated;
grant execute on function public.iniciar_validacion_comprobante(uuid)
  to authenticated;
grant execute on function public.revisar_pago_promocion(uuid, text, text)
  to authenticated;
grant execute on function public.obtener_ruta_comprobante_admin(uuid)
  to authenticated;

grant usage on schema private to authenticated;
grant execute on function private.puede_cargar_comprobante_promocion(text, text)
  to authenticated;

grant execute on function public.finalizar_validacion_comprobante(uuid, text, text, bigint, text, text)
  to service_role;

commit;

-- FIN: propuesta documental. No ejecutada ni validada por PostgreSQL.
