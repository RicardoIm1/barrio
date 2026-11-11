-- RPCs transaccionales del flujo comercial y almacenamiento privado de comprobantes.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('comprobantes-promocion','comprobantes-promocion',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists comprobantes_promocion_insert_propietario on storage.objects;
create policy comprobantes_promocion_insert_propietario on storage.objects
for insert to authenticated with check (
  bucket_id='comprobantes-promocion'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists (
    select 1 from public.solicitudes_promocion s
    where s.id::text=(storage.foldername(name))[2]
      and s.usuario_id=(select auth.uid())
      and s.estado in ('autorizada','pago_rechazado')
  )
);

drop policy if exists comprobantes_promocion_select_propietario_admin on storage.objects;
create policy comprobantes_promocion_select_propietario_admin on storage.objects
for select to authenticated using (
  bucket_id='comprobantes-promocion'
  and (
    (select private.es_admin())
    or exists (
      select 1 from public.solicitudes_promocion s
      where s.id::text=(storage.foldername(name))[2]
        and s.usuario_id=(select auth.uid())
    )
  )
);

create or replace function public.crear_solicitud_promocion(
  p_aviso_id uuid,p_tipo text,p_paquete_id uuid,p_nota_usuario text default null
) returns uuid
language plpgsql security definer set search_path=''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_aviso record;
  v_producto record;
  v_paquete record;
  v_flag_preexistente boolean;
  v_solicitud_id uuid;
  v_nota text := nullif(btrim(p_nota_usuario),'');
begin
  if v_uid is null then raise exception 'Inicia sesión para solicitar una promoción.' using errcode='42501'; end if;
  if not exists(select 1 from public.usuarios u where u.id=v_uid and coalesce(u.activo,true)=true) then
    raise exception 'La cuenta no está activa.' using errcode='42501';
  end if;
  if p_tipo not in ('urgente','destacado') then raise exception 'Tipo de promoción no válido.' using errcode='22023'; end if;
  if length(coalesce(v_nota,''))>1000 then raise exception 'La nota no puede superar 1000 caracteres.' using errcode='22023'; end if;

  select a.id,a.titulo,a.categoria,a.created_by,a.status,a.urgente,a.destacado into v_aviso
  from public.avisos a where a.id=p_aviso_id for update;
  if not found or v_aviso.created_by is distinct from v_uid then
    raise exception 'No se encontró un aviso tuyo para promocionar.' using errcode='42501';
  end if;
  if v_aviso.status<>'activo' then
    raise exception 'Solo puedes solicitar promoción para avisos publicados y activos.' using errcode='22023';
  end if;

  select p.tipo,p.nombre,p.activo into v_producto
  from public.productos_promocion p where p.tipo=p_tipo and p.activo=true;
  if not found then raise exception 'Este producto de promoción no está disponible.' using errcode='22023'; end if;

  select b.id,b.tipo,b.nombre,b.duracion_dias,b.precio,b.moneda into v_paquete
  from public.paquetes_promocion b
  where b.id=p_paquete_id and b.tipo=p_tipo and b.activo=true;
  if not found then raise exception 'El paquete seleccionado no está disponible.' using errcode='22023'; end if;

  v_flag_preexistente := case when p_tipo='urgente' then coalesce(v_aviso.urgente,false) else coalesce(v_aviso.destacado,false) end;

  insert into public.solicitudes_promocion(
    aviso_id,usuario_id,tipo,paquete_id,aviso_titulo_snapshot,categoria_snapshot,
    producto_nombre_snapshot,paquete_nombre_snapshot,precio_snapshot,
    moneda_snapshot,duracion_dias_snapshot,flag_preexistente,estado,nota_usuario
  ) values (
    v_aviso.id,v_uid,p_tipo,v_paquete.id,v_aviso.titulo,v_aviso.categoria,
    v_producto.nombre,v_paquete.nombre,v_paquete.precio,
    v_paquete.moneda,v_paquete.duracion_dias,v_flag_preexistente,'solicitada',v_nota
  ) returning id into v_solicitud_id;

  insert into public.historial_promociones(solicitud_id,actor_id,evento,estado_nuevo,detalle)
  values(v_solicitud_id,v_uid,'solicitud_creada','solicitada',
    jsonb_build_object('tipo',p_tipo,'aviso_id',v_aviso.id,'flag_preexistente',v_flag_preexistente));
  return v_solicitud_id;
exception when unique_violation then
  raise exception 'Ya existe una solicitud o promoción de este tipo para ese aviso.' using errcode='23505';
end;
$function$;
revoke all on function public.crear_solicitud_promocion(uuid,text,uuid,text) from public,anon;
grant execute on function public.crear_solicitud_promocion(uuid,text,uuid,text) to authenticated;

create or replace function public.reportar_pago_promocion(
  p_solicitud_id uuid,p_metodo text,p_referencia text,p_comprobante_path text
) returns uuid
language plpgsql security definer set search_path=''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_solicitud record;
  v_pago_id uuid;
  v_referencia text := nullif(btrim(p_referencia),'');
begin
  if v_uid is null then raise exception 'Inicia sesión para reportar el pago.' using errcode='42501'; end if;
  if p_metodo not in ('transferencia','deposito') then raise exception 'Método de pago no válido.' using errcode='22023'; end if;
  if p_comprobante_path is null
    or (storage.foldername(p_comprobante_path))[1] is distinct from v_uid::text
    or (storage.foldername(p_comprobante_path))[2] is distinct from p_solicitud_id::text then
    raise exception 'La ruta del comprobante no corresponde a tu solicitud.' using errcode='42501';
  end if;

  select s.id,s.usuario_id,s.estado,s.precio_snapshot,s.moneda_snapshot into v_solicitud
  from public.solicitudes_promocion s where s.id=p_solicitud_id for update;
  if not found or v_solicitud.usuario_id is distinct from v_uid then raise exception 'No se encontró tu solicitud.' using errcode='42501'; end if;
  if v_solicitud.estado not in ('autorizada','pago_rechazado') then
    raise exception 'La solicitud todavía no está autorizada para recibir un pago.' using errcode='22023';
  end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='comprobantes-promocion' and o.name=p_comprobante_path) then
    raise exception 'No encontramos el archivo del comprobante. Vuelve a cargarlo.' using errcode='22023';
  end if;

  insert into public.pagos_promocion(solicitud_id,importe,moneda,metodo,referencia,comprobante_path,estado)
  values(p_solicitud_id,v_solicitud.precio_snapshot,v_solicitud.moneda_snapshot,p_metodo,v_referencia,p_comprobante_path,'reportado')
  returning id into v_pago_id;

  update public.solicitudes_promocion set estado='pago_reportado',updated_at=now() where id=p_solicitud_id;
  insert into public.historial_promociones(solicitud_id,pago_id,actor_id,evento,estado_anterior,estado_nuevo,detalle)
  values(p_solicitud_id,v_pago_id,v_uid,'pago_reportado',v_solicitud.estado,'pago_reportado',
    jsonb_build_object('metodo',p_metodo,'referencia',v_referencia));
  return v_pago_id;
exception when unique_violation then
  raise exception 'Ya existe un pago pendiente o verificado para esta solicitud.' using errcode='23505';
end;
$function$;
revoke all on function public.reportar_pago_promocion(uuid,text,text,text) from public,anon;
grant execute on function public.reportar_pago_promocion(uuid,text,text,text) to authenticated;

create or replace function public.admin_revisar_solicitud_promocion(
  p_solicitud_id uuid,p_estado text,p_observaciones text default null
) returns void
language plpgsql security definer set search_path=''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_anterior text;
begin
  if v_uid is null or not (select private.es_admin()) then raise exception 'Solo un administrador puede revisar solicitudes.' using errcode='42501'; end if;
  if p_estado not in ('en_revision','requiere_ajustes','autorizada','rechazada') then raise exception 'Estado de revisión no válido.' using errcode='22023'; end if;
  select estado into v_anterior from public.solicitudes_promocion where id=p_solicitud_id for update;
  if not found or v_anterior not in ('solicitada','en_revision','requiere_ajustes') then raise exception 'La solicitud ya no admite revisión.' using errcode='22023'; end if;
  update public.solicitudes_promocion set estado=p_estado,observaciones_admin=nullif(btrim(p_observaciones),''),revisada_por=v_uid,fecha_revision=now(),updated_at=now() where id=p_solicitud_id;
  insert into public.historial_promociones(solicitud_id,actor_id,evento,estado_anterior,estado_nuevo,detalle)
  values(p_solicitud_id,v_uid,'revision_admin',v_anterior,p_estado,jsonb_build_object('observaciones',nullif(btrim(p_observaciones),'')));
end;
$function$;
revoke all on function public.admin_revisar_solicitud_promocion(uuid,text,text) from public,anon;
grant execute on function public.admin_revisar_solicitud_promocion(uuid,text,text) to authenticated;

create or replace function public.admin_validar_pago_promocion(
  p_pago_id uuid,p_estado text,p_observaciones text default null
) returns uuid
language plpgsql security definer set search_path=''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_pago record;
  v_solicitud record;
  v_promocion_id uuid;
begin
  if v_uid is null or not (select private.es_admin()) then raise exception 'Solo un administrador puede validar pagos.' using errcode='42501'; end if;
  if p_estado not in ('verificado','rechazado') then raise exception 'Resultado de validación no válido.' using errcode='22023'; end if;
  select p.id,p.solicitud_id,p.estado into v_pago from public.pagos_promocion p where p.id=p_pago_id for update;
  if not found or v_pago.estado<>'reportado' then raise exception 'El comprobante ya fue procesado o no existe.' using errcode='22023'; end if;
  select s.* into v_solicitud from public.solicitudes_promocion s where s.id=v_pago.solicitud_id for update;
  if not found or v_solicitud.estado<>'pago_reportado' then raise exception 'La solicitud no está pendiente de validación de pago.' using errcode='22023'; end if;

  update public.pagos_promocion set estado=p_estado,validado_por=v_uid,fecha_validacion=now(),observaciones=nullif(btrim(p_observaciones),''),updated_at=now() where id=p_pago_id;
  if p_estado='rechazado' then
    update public.solicitudes_promocion set estado='pago_rechazado',updated_at=now() where id=v_solicitud.id;
    insert into public.historial_promociones(solicitud_id,pago_id,actor_id,evento,estado_anterior,estado_nuevo,detalle)
    values(v_solicitud.id,p_pago_id,v_uid,'pago_rechazado','pago_reportado','pago_rechazado',jsonb_build_object('observaciones',nullif(btrim(p_observaciones),'')));
    return null;
  end if;

  insert into public.promociones(
    solicitud_id,aviso_id,usuario_id,tipo,aviso_titulo_snapshot,duracion_dias,precio,moneda,
    flag_preexistente,conservar_al_vencer,estado
  ) values (
    v_solicitud.id,v_solicitud.aviso_id,v_solicitud.usuario_id,v_solicitud.tipo,
    v_solicitud.aviso_titulo_snapshot,v_solicitud.duracion_dias_snapshot,
    v_solicitud.precio_snapshot,v_solicitud.moneda_snapshot,
    v_solicitud.flag_preexistente,v_solicitud.flag_preexistente,'activacion_pendiente'
  ) returning id into v_promocion_id;

  update public.solicitudes_promocion set estado='activacion_pendiente',updated_at=now() where id=v_solicitud.id;
  insert into public.historial_promociones(solicitud_id,promocion_id,pago_id,actor_id,evento,estado_anterior,estado_nuevo,detalle)
  values(v_solicitud.id,v_promocion_id,p_pago_id,v_uid,'pago_verificado','pago_reportado','activacion_pendiente','{}'::jsonb);
  return v_promocion_id;
exception when unique_violation then
  raise exception 'Ya existe una promoción activa o pendiente de este tipo para el aviso.' using errcode='23505';
end;
$function$;
revoke all on function public.admin_validar_pago_promocion(uuid,text,text) from public,anon;
grant execute on function public.admin_validar_pago_promocion(uuid,text,text) to authenticated;

create or replace function public.admin_registrar_activacion_promocion(p_promocion_id uuid)
returns timestamptz
language plpgsql security definer set search_path=''
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

  v_fin := v_inicio + make_interval(days=>v_promocion.duracion_dias);
  update public.promociones set estado='activa',fecha_inicio=v_inicio,fecha_fin=v_fin,activada_por=v_uid,updated_at=now() where id=p_promocion_id;
  update public.solicitudes_promocion set estado='activa',updated_at=now() where id=v_promocion.solicitud_id;
  insert into public.historial_promociones(solicitud_id,promocion_id,actor_id,evento,estado_anterior,estado_nuevo,detalle)
  values(v_promocion.solicitud_id,p_promocion_id,v_uid,'activacion_registrada','activacion_pendiente','activa',jsonb_build_object('fecha_inicio',v_inicio,'fecha_fin',v_fin,'tipo',v_promocion.tipo));
  return v_fin;
end;
$function$;
revoke all on function public.admin_registrar_activacion_promocion(uuid) from public,anon;
grant execute on function public.admin_registrar_activacion_promocion(uuid) to authenticated;

create or replace function public.admin_configurar_retiro_promocion(p_promocion_id uuid,p_conservar boolean)
returns void
language plpgsql security definer set search_path=''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_anterior boolean;
begin
  if v_uid is null or not (select private.es_admin()) then raise exception 'Solo un administrador puede configurar el vencimiento.' using errcode='42501'; end if;
  select conservar_al_vencer into v_anterior from public.promociones
  where id=p_promocion_id and estado in ('activacion_pendiente','activa') for update;
  if not found then raise exception 'La promoción ya no admite cambios de vencimiento.' using errcode='22023'; end if;
  update public.promociones set conservar_al_vencer=p_conservar,updated_at=now() where id=p_promocion_id;
  insert into public.historial_promociones(promocion_id,actor_id,evento,detalle)
  values(p_promocion_id,v_uid,'configuracion_vencimiento',jsonb_build_object('conservar_al_vencer_anterior',v_anterior,'conservar_al_vencer_nuevo',p_conservar));
end;
$function$;
revoke all on function public.admin_configurar_retiro_promocion(uuid,boolean) from public,anon;
grant execute on function public.admin_configurar_retiro_promocion(uuid,boolean) to authenticated;

-- La conservación inicial se deriva de si el distintivo ya existía al solicitar.
-- El administrador puede cambiarla desde el módulo comercial.
create or replace function private.expirar_promociones_vencidas()
returns integer language plpgsql security definer set search_path=''
as $function$
declare
  r record;
  v_filas integer;
  v_resultado text;
  v_total integer:=0;
begin
  if session_user<>'postgres' then raise exception 'Ejecución no autorizada para vencimiento de promociones.' using errcode='42501'; end if;
  perform set_config('app.elbarrio_promociones_expiracion','1',true);

  for r in
    select p.id,p.solicitud_id,p.aviso_id,p.tipo,p.conservar_al_vencer
    from public.promociones p
    where p.estado='activa' and p.fecha_fin<=now()
    order by p.fecha_fin for update skip locked
  loop
    if r.conservar_al_vencer then
      v_resultado:='conservada';
    elsif r.aviso_id is null then
      v_resultado:='aviso_eliminado';
    elsif r.tipo='urgente' then
      update public.avisos set urgente=false where id=r.aviso_id and urgente is true;
      get diagnostics v_filas=row_count;
      v_resultado:=case when v_filas>0 then 'desactivada_automaticamente' else 'ya_desactivada' end;
    elsif r.tipo='destacado' then
      update public.avisos set destacado=false where id=r.aviso_id and destacado is true;
      get diagnostics v_filas=row_count;
      v_resultado:=case when v_filas>0 then 'desactivada_automaticamente' else 'ya_desactivada' end;
    else
      raise exception 'Tipo de promoción no reconocido: %',r.tipo;
    end if;

    update public.promociones set estado='vencida',fecha_desactivacion=now(),resultado_vencimiento=v_resultado,updated_at=now() where id=r.id;
    update public.solicitudes_promocion set estado='vencida',updated_at=now()
      where id=r.solicitud_id and estado in ('activa','activacion_pendiente');
    insert into public.historial_promociones(solicitud_id,promocion_id,evento,estado_anterior,estado_nuevo,detalle)
    values(r.solicitud_id,r.id,'vencimiento_automatico','activa','vencida',jsonb_build_object('resultado',v_resultado,'fecha_fin',now()));
    v_total:=v_total+1;
  end loop;

  perform set_config('app.elbarrio_promociones_expiracion','0',true);
  return v_total;
end;
$function$;
revoke all on function private.expirar_promociones_vencidas() from public,anon,authenticated,service_role;
