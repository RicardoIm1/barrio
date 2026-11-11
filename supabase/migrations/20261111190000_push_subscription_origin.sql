-- Identifica el dominio que registró cada suscripción Web Push.
-- Los registros históricos permanecen sin origen y se conservan como fallback
-- hasta que cada dispositivo vuelva a sincronizar desde el dominio oficial.
alter table public.push_subscriptions
  add column if not exists origen text;

create index if not exists idx_push_subscriptions_usuario_activo_origen
  on public.push_subscriptions (usuario_id, activo, origen);
