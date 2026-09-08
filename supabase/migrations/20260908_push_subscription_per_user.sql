-- ============================================================
-- EL BARRIO · Web Push
-- Una suscripción del navegador puede existir para más de un
-- usuario local. La unicidad debe ser por usuario + endpoint,
-- no global por endpoint.
-- ============================================================

alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_endpoint_key;

create unique index if not exists push_subscriptions_usuario_endpoint_key
  on public.push_subscriptions (usuario_id, endpoint);
