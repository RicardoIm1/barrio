-- Web Push para mensajes privados de El Barrio.
-- Ruta separada: conserva intacto el trigger existente de notificaciones.

create or replace function public.disparar_send_push_mensaje_privado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  select ds.decrypted_secret
    into v_secret
  from vault.decrypted_secrets as ds
  where ds.name = 'elbarrio_send_push_key'
  limit 1;

  if v_secret is null then
    raise warning 'El Barrio: no se encontró el secreto elbarrio_send_push_key para mensajes privados';
    return new;
  end if;

  perform net.http_post(
    url := 'https://gnjaumpjerbbwlkcgxqa.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_secret
    ),
    body := jsonb_build_object(
      'private_message_id', new.id
    )
  );

  return new;

exception
  when others then
    -- Un fallo de Web Push jamás debe impedir guardar ni entregar el mensaje.
    raise warning 'El Barrio: error al invocar push de mensaje privado: %', sqlerrm;
    return new;
end;
$$;

drop trigger if exists trigger_mensajes_privados_send_push on public.mensajes_privados;

create trigger trigger_mensajes_privados_send_push
after insert on public.mensajes_privados
for each row
execute function public.disparar_send_push_mensaje_privado();

revoke all on function public.disparar_send_push_mensaje_privado() from public, anon, authenticated;
