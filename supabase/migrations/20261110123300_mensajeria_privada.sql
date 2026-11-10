-- Mensajería privada entre usuarios autenticados de El Barrio.
create table if not exists public.mensajes_privados (
  id uuid primary key default gen_random_uuid(),
  remitente_id uuid not null references public.usuarios(id) on delete cascade,
  destinatario_id uuid not null references public.usuarios(id) on delete cascade,
  contenido text not null,
  created_at timestamptz not null default now(),
  leido_at timestamptz,
  constraint mensajes_privados_no_automensaje check (remitente_id <> destinatario_id),
  constraint mensajes_privados_contenido_valido check (char_length(btrim(contenido)) between 1 and 2000)
);

create index if not exists mensajes_privados_remitente_fecha_idx on public.mensajes_privados (remitente_id, created_at desc);
create index if not exists mensajes_privados_destinatario_fecha_idx on public.mensajes_privados (destinatario_id, created_at desc);

alter table public.mensajes_privados enable row level security;
revoke all on public.mensajes_privados from anon, public;
revoke update, delete, truncate, references, trigger on public.mensajes_privados from authenticated;
grant select, insert on public.mensajes_privados to authenticated;

drop policy if exists mensajes_privados_select_participantes on public.mensajes_privados;
create policy mensajes_privados_select_participantes on public.mensajes_privados
for select to authenticated
using ((select auth.uid()) = remitente_id or (select auth.uid()) = destinatario_id);

drop policy if exists mensajes_privados_insert_remitente on public.mensajes_privados;
create policy mensajes_privados_insert_remitente on public.mensajes_privados
for insert to authenticated
with check (
  (select auth.uid()) = remitente_id
  and destinatario_id <> (select auth.uid())
  and exists (select 1 from public.usuarios u where u.id = destinatario_id and u.activo is true)
);

create or replace function public.obtener_usuarios_conectados()
returns table(usuario_id uuid, nombre text, ultima_actividad timestamptz)
language sql stable security definer set search_path = ''
as $function$
  select u.id, coalesce(nullif(btrim(u.nombre), ''), 'Vecino')::text, p.ultima_actividad
  from public.presencia_usuarios p
  join public.usuarios u on u.id = p.usuario_id
  where (select auth.uid()) is not null
    and u.activo is true
    and p.ultima_actividad >= now() - interval '2 minutes'
  order by p.ultima_actividad desc;
$function$;
revoke all on function public.obtener_usuarios_conectados() from public, anon;
grant execute on function public.obtener_usuarios_conectados() to authenticated;

create or replace function public.marcar_mensajes_leidos(p_remitente_id uuid)
returns integer language plpgsql security definer set search_path = ''
as $function$
declare
  v_usuario_id uuid := (select auth.uid());
  v_actualizados integer := 0;
begin
  if v_usuario_id is null or p_remitente_id is null or p_remitente_id = v_usuario_id then
    raise exception 'No autorizado';
  end if;
  update public.mensajes_privados set leido_at = now()
   where remitente_id = p_remitente_id and destinatario_id = v_usuario_id and leido_at is null;
  get diagnostics v_actualizados = row_count;
  return v_actualizados;
end;
$function$;
revoke all on function public.marcar_mensajes_leidos(uuid) from public, anon;
grant execute on function public.marcar_mensajes_leidos(uuid) to authenticated;

create or replace function public.obtener_conversaciones_privadas()
returns table(usuario_id uuid,nombre text,ultimo_mensaje text,ultima_fecha timestamptz,mensajes_no_leidos bigint)
language sql stable security definer set search_path = ''
as $function$
  with conversaciones as (
    select case when m.remitente_id = (select auth.uid()) then m.destinatario_id else m.remitente_id end as otro_id,
           max(m.created_at) as ultima_fecha,
           count(*) filter (where m.destinatario_id = (select auth.uid()) and m.leido_at is null) as no_leidos
    from public.mensajes_privados m
    where (select auth.uid()) is not null
      and (m.remitente_id = (select auth.uid()) or m.destinatario_id = (select auth.uid()))
    group by 1
  )
  select c.otro_id,coalesce(nullif(btrim(u.nombre), ''),'Vecino')::text,ult.contenido,c.ultima_fecha,c.no_leidos
  from conversaciones c
  join public.usuarios u on u.id = c.otro_id
  join lateral (
    select m.contenido from public.mensajes_privados m
    where (m.remitente_id = (select auth.uid()) and m.destinatario_id = c.otro_id)
       or (m.remitente_id = c.otro_id and m.destinatario_id = (select auth.uid()))
    order by m.created_at desc limit 1
  ) ult on true
  order by c.ultima_fecha desc;
$function$;
revoke all on function public.obtener_conversaciones_privadas() from public, anon;
grant execute on function public.obtener_conversaciones_privadas() to authenticated;

do $publication$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='mensajes_privados') then
    alter publication supabase_realtime add table public.mensajes_privados;
  end if;
end
$publication$;
