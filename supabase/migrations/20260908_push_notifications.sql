-- ============================================================
-- EL BARRIO · Notificaciones Web Push
-- ============================================================
-- No cambia votos ni notificaciones. Solo genera filas en
-- public.notificaciones cuando ocurre una interacción relevante.

create or replace function public.notificar_comentario_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  propietario uuid;
  nombre_comentarista text;
begin
  select a.created_by
    into propietario
  from public.avisos a
  where a.id = new.aviso_id;

  if propietario is null then
    return new;
  end if;

  -- El propietario no recibe notificación de su propio comentario.
  if new.usuario_id is not null and new.usuario_id = propietario then
    return new;
  end if;

  nombre_comentarista := nullif(trim(coalesce(new.nombre_autor, '')), '');

  insert into public.notificaciones (
    usuario_id,
    tipo,
    mensaje,
    aviso_id
  )
  values (
    propietario,
    'comentario',
    case
      when nombre_comentarista is not null
        then nombre_comentarista || ' comentó en tu aviso'
      else 'Alguien comentó en tu aviso'
    end,
    new.aviso_id
  );

  return new;
end;
$$;

create or replace function public.notificar_voto_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  propietario uuid;
  tipo_notificacion text;
  mensaje_notificacion text;
begin
  select a.created_by
    into propietario
  from public.avisos a
  where a.id = new.aviso_id;

  if propietario is null then
    return new;
  end if;

  -- El propietario no recibe notificación de su propio voto.
  if new.usuario_id is not null and new.usuario_id = propietario then
    return new;
  end if;

  -- INSERT = nuevo voto. UPDATE = cambio entre like/dislike.
  if tg_op = 'UPDATE' and old.tipo is not distinct from new.tipo then
    return new;
  end if;

  tipo_notificacion := case
    when new.tipo = 'positivo' then 'like'
    when new.tipo = 'negativo' then 'dislike'
    else null
  end;

  if tipo_notificacion is null then
    return new;
  end if;

  mensaje_notificacion := case
    when tipo_notificacion = 'like' then 'A alguien le gustó tu aviso'
    else 'Alguien marcó tu aviso como no recomendado'
  end;

  insert into public.notificaciones (
    usuario_id,
    tipo,
    mensaje,
    aviso_id
  )
  values (
    propietario,
    tipo_notificacion,
    mensaje_notificacion,
    new.aviso_id
  );

  return new;
end;
$$;

drop trigger if exists trg_notificar_comentario_push on public.comentarios;
create trigger trg_notificar_comentario_push
after insert on public.comentarios
for each row
execute function public.notificar_comentario_push();

drop trigger if exists trg_notificar_voto_push on public.votos;
create trigger trg_notificar_voto_push
after insert or update of tipo on public.votos
for each row
execute function public.notificar_voto_push();
