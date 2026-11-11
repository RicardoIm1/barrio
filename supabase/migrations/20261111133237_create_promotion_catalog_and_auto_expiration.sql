-- El Barrio: base de promociones y vencimiento automatico.
-- Los atributos de aviso siguen siendo independientes de categoria.

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create table public.productos_promocion (
  tipo text primary key check (tipo in ('urgente','destacado')),
  nombre text not null,
  descripcion text,
  activo boolean not null default true,
  requiere_revision boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.paquetes_promocion (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  tipo text not null references public.productos_promocion(tipo) on update cascade on delete restrict,
  nombre text not null,
  duracion_dias integer not null check (duracion_dias > 0),
  precio numeric(10,2) not null check (precio >= 0),
  moneda text not null default 'MXN' check (moneda = 'MXN'),
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.solicitudes_promocion (
  id uuid primary key default gen_random_uuid(),
  aviso_id uuid references public.avisos(id) on delete set null,
  usuario_id uuid references public.usuarios(id) on delete set null,
  tipo text not null references public.productos_promocion(tipo) on update cascade on delete restrict,
  paquete_id uuid references public.paquetes_promocion(id) on delete set null,
  aviso_titulo_snapshot text not null,
  categoria_snapshot text,
  producto_nombre_snapshot text not null,
  paquete_nombre_snapshot text not null,
  precio_snapshot numeric(10,2) not null check (precio_snapshot >= 0),
  moneda_snapshot text not null default 'MXN' check (moneda_snapshot = 'MXN'),
  duracion_dias_snapshot integer not null check (duracion_dias_snapshot > 0),
  flag_preexistente boolean not null default false,
  estado text not null default 'solicitada'
    check (estado in ('solicitada','en_revision','requiere_ajustes','autorizada','pago_reportado','pago_rechazado','pago_verificado','activacion_pendiente','activa','vencida','rechazada','cancelada')),
  nota_usuario text,
  observaciones_admin text,
  revisada_por uuid references public.usuarios(id) on delete set null,
  fecha_revision timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pagos_promocion (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes_promocion(id) on delete restrict,
  importe numeric(10,2) not null check (importe >= 0),
  moneda text not null default 'MXN' check (moneda = 'MXN'),
  metodo text not null check (metodo in ('transferencia','deposito')),
  referencia text,
  comprobante_path text,
  estado text not null default 'reportado' check (estado in ('reportado','verificado','rechazado')),
  validado_por uuid references public.usuarios(id) on delete set null,
  fecha_reporte timestamptz not null default now(),
  fecha_validacion timestamptz,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.promociones (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null unique references public.solicitudes_promocion(id) on delete restrict,
  aviso_id uuid references public.avisos(id) on delete set null,
  usuario_id uuid references public.usuarios(id) on delete set null,
  tipo text not null references public.productos_promocion(tipo) on update cascade on delete restrict,
  aviso_titulo_snapshot text not null,
  duracion_dias integer not null check (duracion_dias > 0),
  precio numeric(10,2) not null check (precio >= 0),
  moneda text not null default 'MXN' check (moneda = 'MXN'),
  flag_preexistente boolean not null default false,
  conservar_al_vencer boolean not null default false,
  estado text not null default 'activacion_pendiente'
    check (estado in ('activacion_pendiente','activa','vencida','cancelada')),
  fecha_inicio timestamptz,
  fecha_fin timestamptz,
  activada_por uuid references public.usuarios(id) on delete set null,
  fecha_desactivacion timestamptz,
  resultado_vencimiento text
    check (resultado_vencimiento in ('desactivada_automaticamente','conservada','ya_desactivada','aviso_eliminado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (estado = 'activacion_pendiente' and fecha_inicio is null and fecha_fin is null)
    or
    (estado in ('activa','vencida','cancelada') and fecha_inicio is not null and fecha_fin is not null)
  )
);

create table public.historial_promociones (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid references public.solicitudes_promocion(id) on delete set null,
  promocion_id uuid references public.promociones(id) on delete set null,
  pago_id uuid references public.pagos_promocion(id) on delete set null,
  actor_id uuid references public.usuarios(id) on delete set null,
  evento text not null,
  estado_anterior text,
  estado_nuevo text,
  detalle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index solicitudes_promocion_usuario_idx on public.solicitudes_promocion(usuario_id, created_at desc);
create index solicitudes_promocion_aviso_idx on public.solicitudes_promocion(aviso_id, tipo, created_at desc);
create unique index solicitudes_promocion_abierta_unica
  on public.solicitudes_promocion(aviso_id, tipo)
  where aviso_id is not null and estado in ('solicitada','en_revision','requiere_ajustes','autorizada','pago_reportado','pago_verificado','activacion_pendiente','activa');

create index pagos_promocion_solicitud_idx on public.pagos_promocion(solicitud_id, created_at desc);
create unique index pagos_promocion_uno_pendiente
  on public.pagos_promocion(solicitud_id)
  where estado in ('reportado','verificado');

create index promociones_vencimiento_idx on public.promociones(fecha_fin)
  where estado = 'activa';
create unique index promociones_aviso_tipo_en_curso_unica
  on public.promociones(aviso_id, tipo)
  where aviso_id is not null and estado in ('activacion_pendiente','activa');

create index historial_promociones_solicitud_idx on public.historial_promociones(solicitud_id, created_at desc);

insert into public.productos_promocion(tipo,nombre,descripcion)
values
  ('destacado','Destacado','Mayor visibilidad para tu aviso durante el periodo contratado.'),
  ('urgente','Urgente','Prioridad de exposición para avisos que requieren atención.')
on conflict (tipo) do nothing;

insert into public.paquetes_promocion(codigo,tipo,nombre,duracion_dias,precio,moneda,orden)
values
  ('destacado-30','destacado','Destacado por 30 días',30,299.00,'MXN',1),
  ('urgente-7','urgente','Urgente por 7 días',7,99.00,'MXN',1)
on conflict (codigo) do nothing;

alter table public.productos_promocion enable row level security;
alter table public.paquetes_promocion enable row level security;
alter table public.solicitudes_promocion enable row level security;
alter table public.pagos_promocion enable row level security;
alter table public.promociones enable row level security;
alter table public.historial_promociones enable row level security;

revoke all on public.productos_promocion, public.paquetes_promocion,
  public.solicitudes_promocion, public.pagos_promocion,
  public.promociones, public.historial_promociones
from anon, authenticated;

grant select on public.productos_promocion, public.paquetes_promocion to anon, authenticated;
grant select on public.solicitudes_promocion, public.pagos_promocion,
  public.promociones, public.historial_promociones to authenticated;

create policy productos_promocion_catalogo_activo
  on public.productos_promocion for select to anon, authenticated
  using (activo = true);

create policy paquetes_promocion_catalogo_activo
  on public.paquetes_promocion for select to anon, authenticated
  using (activo = true and exists (
    select 1 from public.productos_promocion p
    where p.tipo = paquetes_promocion.tipo and p.activo = true
  ));

create policy solicitudes_promocion_propietario_admin
  on public.solicitudes_promocion for select to authenticated
  using (usuario_id = (select auth.uid()) or (select private.es_admin()));

create policy pagos_promocion_propietario_admin
  on public.pagos_promocion for select to authenticated
  using (
    exists (
      select 1 from public.solicitudes_promocion s
      where s.id = pagos_promocion.solicitud_id
        and (s.usuario_id = (select auth.uid()) or (select private.es_admin()))
    )
  );

create policy promociones_propietario_admin
  on public.promociones for select to authenticated
  using (usuario_id = (select auth.uid()) or (select private.es_admin()));

create policy historial_promociones_propietario_admin
  on public.historial_promociones for select to authenticated
  using (
    exists (
      select 1 from public.solicitudes_promocion s
      where s.id = historial_promociones.solicitud_id
        and (s.usuario_id = (select auth.uid()) or (select private.es_admin()))
    )
  );

-- El trigger sigue bloqueando cambios del cliente. Solo la rutina interna de vencimiento,
-- ejecutada por el usuario de base de datos postgres, recibe esta excepción acotada.
create or replace function public.proteger_campos_promocionales()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_expiracion_interna boolean :=
    session_user = 'postgres'
    and current_setting('app.elbarrio_promociones_expiracion', true) = '1';
begin
  if not private.es_admin() and not v_expiracion_interna then
    if tg_op = 'INSERT' then
      new.destacado := false;
      new.urgente := false;
    else
      new.destacado := old.destacado;
      new.urgente := old.urgente;
    end if;
  end if;

  return new;
end;
$function$;

create or replace function private.expirar_promociones_vencidas()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  r record;
  v_filas integer;
  v_resultado text;
  v_total integer := 0;
begin
  if session_user <> 'postgres' then
    raise exception 'Ejecución no autorizada para vencimiento de promociones.'
      using errcode = '42501';
  end if;

  perform set_config('app.elbarrio_promociones_expiracion', '1', true);

  for r in
    select p.id, p.solicitud_id, p.aviso_id, p.tipo, p.flag_preexistente,
           p.conservar_al_vencer, p.estado
    from public.promociones p
    where p.estado = 'activa'
      and p.fecha_fin <= now()
    order by p.fecha_fin
    for update skip locked
  loop
    v_resultado := null;

    if r.flag_preexistente or r.conservar_al_vencer then
      v_resultado := 'conservada';
    elsif r.aviso_id is null then
      v_resultado := 'aviso_eliminado';
    elsif r.tipo = 'urgente' then
      update public.avisos
      set urgente = false
      where id = r.aviso_id and urgente is true;
      get diagnostics v_filas = row_count;
      v_resultado := case when v_filas > 0 then 'desactivada_automaticamente' else 'ya_desactivada' end;
    elsif r.tipo = 'destacado' then
      update public.avisos
      set destacado = false
      where id = r.aviso_id and destacado is true;
      get diagnostics v_filas = row_count;
      v_resultado := case when v_filas > 0 then 'desactivada_automaticamente' else 'ya_desactivada' end;
    else
      raise exception 'Tipo de promoción no reconocido: %', r.tipo;
    end if;

    update public.promociones
    set estado = 'vencida',
        fecha_desactivacion = now(),
        resultado_vencimiento = v_resultado,
        updated_at = now()
    where id = r.id;

    update public.solicitudes_promocion
    set estado = 'vencida', updated_at = now()
    where id = r.solicitud_id
      and estado in ('activa','activacion_pendiente');

    insert into public.historial_promociones(
      solicitud_id, promocion_id, evento, estado_anterior, estado_nuevo, detalle
    )
    values (
      r.solicitud_id, r.id, 'vencimiento_automatico', 'activa', 'vencida',
      jsonb_build_object('resultado', v_resultado, 'fecha_fin', now())
    );

    v_total := v_total + 1;
  end loop;

  perform set_config('app.elbarrio_promociones_expiracion', '0', true);
  return v_total;
end;
$function$;

revoke all on function private.expirar_promociones_vencidas() from public, anon, authenticated, service_role;

do $job$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'elbarrio-expirar-promociones';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'elbarrio-expirar-promociones',
    '* * * * *',
    'select private.expirar_promociones_vencidas();'
  );
end;
$job$;
