-- Retención temporal de comprobantes: siete días naturales desde la activación.
-- La imagen se elimina vía Storage API; los metadatos e historial se conservan.

alter table public.pagos_promocion
  add column if not exists comprobante_retenido_hasta timestamptz,
  add column if not exists retener_comprobante boolean not null default false,
  add column if not exists retencion_motivo text,
  add column if not exists retencion_por uuid references public.usuarios(id) on delete set null,
  add column if not exists retencion_fecha timestamptz,
  add column if not exists comprobante_eliminado_at timestamptz,
  add column if not exists comprobante_intentos integer not null default 0 check (comprobante_intentos >= 0),
  add column if not exists comprobante_ultimo_error text,
  add column if not exists comprobante_ultimo_intento_at timestamptz;

create index if not exists pagos_promocion_comprobantes_vencidos_idx
on public.pagos_promocion(comprobante_retenido_hasta)
where comprobante_path is not null and comprobante_eliminado_at is null and retener_comprobante=false;

create or replace function public.admin_registrar_activacion_promocion(p_promocion_id uuid)
returns timestamptz language plpgsql security definer set search_path=''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_promocion record;
  v_flag boolean;
  v_inicio timestamptz := now();
  v_fin timestamptz;
begin
  if v_uid is null or not (select private.es_admin()) then raise exception 'Solo un administrador puede registrar activaciones.' using errcode='42501'; end if;
  select p.* into v_promocion from public.promociones p where p.id=p_promocion_id for update;
  if not found or v_promocion.estado<>'activacion_pendiente' then raise exception 'La promoción no está pendiente de activación.' using errcode='22023'; end if;
  if not exists(select 1 from public.pagos_promocion pg where pg.solicitud_id=v_promocion.solicitud_id and pg.estado='verificado') then raise exception 'El pago todavía no está verificado.' using errcode='22023'; end if;
  if v_promocion.aviso_id is null then raise exception 'El aviso ya no está disponible.' using errcode='22023'; end if;

  if v_promocion.tipo='urgente' then
    select a.urgente into v_flag from public.avisos a where a.id=v_promocion.aviso_id and a.status='activo';
  else
    select a.destacado into v_flag from public.avisos a where a.id=v_promocion.aviso_id and a.status='activo';
  end if;
  if not found or v_flag is distinct from true then raise exception 'Primero marca el distintivo correspondiente en el administrador actual.' using errcode='22023'; end if;

  v_fin:=v_inicio+make_interval(days=>v_promocion.duracion_dias);
  update public.promociones set estado='activa',fecha_inicio=v_inicio,fecha_fin=v_fin,activada_por=v_uid,updated_at=now() where id=p_promocion_id;
  update public.solicitudes_promocion set estado='activa',updated_at=now() where id=v_promocion.solicitud_id;

  update public.pagos_promocion
  set comprobante_retenido_hasta=v_inicio+interval '7 days',updated_at=now()
  where solicitud_id=v_promocion.solicitud_id and estado='verificado'
    and comprobante_path is not null and comprobante_eliminado_at is null;

  insert into public.historial_promociones(solicitud_id,promocion_id,actor_id,evento,estado_anterior,estado_nuevo,detalle)
  values(v_promocion.solicitud_id,p_promocion_id,v_uid,'activacion_registrada','activacion_pendiente','activa',
    jsonb_build_object('fecha_inicio',v_inicio,'fecha_fin',v_fin,'tipo',v_promocion.tipo,'comprobante_retenido_hasta',v_inicio+interval '7 days'));
  return v_fin;
end;
$function$;
revoke all on function public.admin_registrar_activacion_promocion(uuid) from public,anon,service_role;
grant execute on function public.admin_registrar_activacion_promocion(uuid) to authenticated;

create or replace function public.admin_configurar_retencion_comprobante(
  p_pago_id uuid,p_retener boolean,p_motivo text default null
) returns void
language plpgsql security definer set search_path=''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_anterior boolean;
  v_motivo text := nullif(btrim(p_motivo),'');
begin
  if v_uid is null or not (select private.es_admin()) then raise exception 'Solo un administrador puede modificar la retención de comprobantes.' using errcode='42501'; end if;
  if p_retener and (v_motivo is null or length(v_motivo)<5) then raise exception 'Indica un motivo de al menos cinco caracteres para suspender la eliminación.' using errcode='22023'; end if;
  select retener_comprobante into v_anterior from public.pagos_promocion where id=p_pago_id for update;
  if not found then raise exception 'No se encontró el comprobante.' using errcode='22023'; end if;

  update public.pagos_promocion
  set retener_comprobante=p_retener,
      retencion_motivo=case when p_retener then v_motivo else null end,
      retencion_por=v_uid,retencion_fecha=now(),updated_at=now()
  where id=p_pago_id;

  insert into public.historial_promociones(solicitud_id,pago_id,actor_id,evento,detalle)
  select solicitud_id,id,v_uid,
    case when p_retener then 'retencion_comprobante_activada' else 'retencion_comprobante_liberada' end,
    jsonb_build_object('retener_anterior',v_anterior,'retener_nuevo',p_retener,'motivo',case when p_retener then v_motivo else null end)
  from public.pagos_promocion where id=p_pago_id;
end;
$function$;
revoke all on function public.admin_configurar_retencion_comprobante(uuid,boolean,text) from public,anon,service_role;
grant execute on function public.admin_configurar_retencion_comprobante(uuid,boolean,text) to authenticated;

create or replace function public.validar_token_limpieza_comprobantes(p_token text)
returns boolean language sql security definer set search_path=''
as $function$
  select coalesce(
    p_token is not null and exists(
      select 1 from vault.decrypted_secrets s
      where s.name='elbarrio_promocion_cleanup_token' and s.decrypted_secret=p_token
    ),false
  );
$function$;
revoke all on function public.validar_token_limpieza_comprobantes(text) from public,anon,authenticated;
grant execute on function public.validar_token_limpieza_comprobantes(text) to service_role;

do $secrets$
begin
  if not exists(select 1 from vault.secrets where name='elbarrio_promocion_cleanup_token') then
    perform vault.create_secret(encode(gen_random_bytes(32),'hex'),'elbarrio_promocion_cleanup_token',
      'Token interno para autorizar la limpieza programada de comprobantes de El Barrio',null);
  end if;
  if not exists(select 1 from vault.secrets where name='elbarrio_publishable_key') then
    perform vault.create_secret('sb_publishable_x01F_xzyh5b-sZdwhKh6FQ_OzQVxMpN',
      'elbarrio_publishable_key','Clave pública para invocar funciones internas desde pg_net',null);
  end if;
end;
$secrets$;

do $job$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname='elbarrio-eliminar-comprobantes-promocion';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'elbarrio-eliminar-comprobantes-promocion','*/15 * * * *',
    $command$
      select net.http_post(
        url:='https://gnjaumpjerbbwlkcgxqa.supabase.co/functions/v1/cleanup-promotion-receipts',
        headers:=jsonb_build_object(
          'Content-Type','application/json',
          'apikey',(select decrypted_secret from vault.decrypted_secrets where name='elbarrio_publishable_key'),
          'x-cleanup-token',(select decrypted_secret from vault.decrypted_secrets where name='elbarrio_promocion_cleanup_token')
        ),
        body:=jsonb_build_object('source','pg_cron'),
        timeout_milliseconds:=10000
      ) as request_id;
    $command$
  );
end;
$job$;
