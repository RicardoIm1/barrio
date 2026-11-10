-- PROPUESTA NO EJECUTABLE EN PRODUCCION.
-- Borrador de esquema base del modulo comercial de promociones.
-- Rama: feature/promociones-aprobadas
-- Este archivo NO ha sido aplicado a Supabase.
-- Requiere revision de DDL, RLS, RPCs y bucket privado antes de cualquier ejecucion.
-- No modifica public.avisos, sus flags urgente/destacado, campanas_destacado ni storage.

begin;

create table if not exists public.promocion_productos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  tipo text not null check (tipo in ('destacado', 'urgente')),
  nombre text not null,
  precio_centavos integer not null check (precio_centavos > 0),
  moneda text not null default 'MXN' check (moneda = 'MXN'),
  duracion_dias integer not null check (duracion_dias > 0),
  version integer not null default 1 check (version > 0),
  activo boolean not null default true,
  vigente_desde timestamptz,
  vigente_hasta timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (vigente_hasta is null or vigente_desde is null or vigente_hasta > vigente_desde)
);

create table if not exists public.solicitudes_promocion (
  id uuid primary key default gen_random_uuid(),
  aviso_id uuid not null references public.avisos(id) on delete restrict,
  solicitante_id uuid not null references public.usuarios(id) on delete restrict,
  estado text not null default 'pendiente_revision'
    check (estado in (
      'pendiente_revision', 'requiere_ajustes', 'rechazada',
      'aprobada_pendiente_pago', 'pago_reportado', 'pago_observado',
      'pago_verificado', 'revision_administrativa', 'activa',
      'vencida', 'cancelada'
    )),
  total_centavos integer not null check (total_centavos > 0),
  moneda text not null default 'MXN' check (moneda = 'MXN'),
  nota_solicitante text,
  nota_admin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.usuarios(id) on delete restrict,
  cancelled_at timestamptz,
  cancelled_by uuid references public.usuarios(id) on delete restrict,
  cancellation_reason text,
  check (
    (estado = 'cancelada' and cancelled_at is not null and cancelled_by is not null)
    or (estado <> 'cancelada' and cancelled_at is null and cancelled_by is null)
  )
);

create table if not exists public.solicitud_promocion_items (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes_promocion(id) on delete restrict,
  producto_id uuid references public.promocion_productos(id) on delete set null,
  tipo_snapshot text not null check (tipo_snapshot in ('destacado', 'urgente')),
  nombre_snapshot text not null,
  precio_centavos_snapshot integer not null check (precio_centavos_snapshot > 0),
  moneda_snapshot text not null default 'MXN' check (moneda_snapshot = 'MXN'),
  duracion_dias_snapshot integer not null check (duracion_dias_snapshot > 0),
  created_at timestamptz not null default now(),
  unique (solicitud_id, tipo_snapshot),
  unique (id, solicitud_id)
);

create table if not exists public.pagos_promocion (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes_promocion(id) on delete restrict,
  reportado_por uuid not null references public.usuarios(id) on delete restrict,
  importe_centavos_reportado integer not null check (importe_centavos_reportado > 0),
  moneda text not null default 'MXN' check (moneda = 'MXN'),
  comprobante_path text not null unique,
  estado text not null default 'reportado'
    check (estado in ('reportado', 'observado', 'verificado', 'rechazado')),
  referencia_operacion text,
  observacion_admin text,
  reportado_at timestamptz not null default now(),
  revisado_at timestamptz,
  revisado_por uuid references public.usuarios(id) on delete restrict,
  -- Pago verificado: activacion + 7 dias. Pago observado/rechazado: revision + 7 dias.
  comprobante_eliminar_despues_de timestamptz,
  comprobante_eliminado_at timestamptz,
  retencion_suspendida boolean not null default false,
  retencion_motivo text,
  retencion_liberada_at timestamptz,
  retencion_liberada_por uuid references public.usuarios(id) on delete restrict,
  ultimo_intento_borrado_at timestamptz,
  ultimo_error_borrado text,
  check (
    (retencion_suspendida and nullif(btrim(retencion_motivo), '') is not null)
    or (not retencion_suspendida)
  ),
  check (
    comprobante_eliminado_at is null
    or comprobante_eliminar_despues_de is not null
  )
);

create table if not exists public.promociones_activas (
  id uuid primary key default gen_random_uuid(),
  solicitud_item_id uuid not null unique,
  solicitud_id uuid not null references public.solicitudes_promocion(id) on delete restrict,
  aviso_id uuid not null references public.avisos(id) on delete restrict,
  tipo text not null check (tipo in ('destacado', 'urgente')),
  estado text not null default 'activa'
    check (estado in ('programada', 'activa', 'vencida', 'cancelada')),
  activada_at timestamptz not null,
  vence_at timestamptz not null,
  activada_por uuid not null references public.usuarios(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (solicitud_item_id, solicitud_id)
    references public.solicitud_promocion_items(id, solicitud_id) on delete restrict,
  check (vence_at > activada_at)
);

create table if not exists public.eventos_promocion (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes_promocion(id) on delete restrict,
  solicitud_item_id uuid references public.solicitud_promocion_items(id) on delete restrict,
  pago_id uuid references public.pagos_promocion(id) on delete restrict,
  promocion_id uuid references public.promociones_activas(id) on delete restrict,
  actor_id uuid references public.usuarios(id) on delete restrict,
  actor_tipo text not null check (actor_tipo in ('usuario', 'admin', 'sistema')),
  evento text not null,
  estado_anterior text,
  estado_nuevo text,
  detalle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_solicitudes_promocion_aviso
  on public.solicitudes_promocion (aviso_id, created_at desc);
create index if not exists idx_solicitudes_promocion_solicitante
  on public.solicitudes_promocion (solicitante_id, created_at desc);
create index if not exists idx_solicitudes_promocion_estado
  on public.solicitudes_promocion (estado);
create index if not exists idx_items_promocion_solicitud
  on public.solicitud_promocion_items (solicitud_id);
create index if not exists idx_pagos_promocion_solicitud
  on public.pagos_promocion (solicitud_id, reportado_at desc);
create index if not exists idx_pagos_promocion_retencion
  on public.pagos_promocion (comprobante_eliminar_despues_de)
  where comprobante_eliminado_at is null and comprobante_path is not null;
create index if not exists idx_promociones_activas_aviso_tipo_estado
  on public.promociones_activas (aviso_id, tipo, estado, vence_at);

-- Defensa final contra dos promociones simultaneas del mismo tipo y aviso.
-- La RPC de activacion debe bloquear primero la fila de public.avisos y
-- marcar vencidas las filas cuyo vence_at <= now() antes de insertar.
create unique index if not exists uq_promociones_activas_aviso_tipo_vigente
  on public.promociones_activas (aviso_id, tipo)
  where estado in ('programada', 'activa');

-- Solo puede existir un pago verificado por solicitud.
create unique index if not exists uq_pagos_promocion_un_verificado
  on public.pagos_promocion (solicitud_id)
  where estado = 'verificado';
create index if not exists idx_eventos_promocion_solicitud
  on public.eventos_promocion (solicitud_id, created_at desc);

-- RLS se activa desde el inicio. No se conceden accesos directos a anon/authenticated.
-- El acceso se habilitara despues, mediante politicas especificas y RPCs revisadas.
alter table public.promocion_productos enable row level security;
alter table public.solicitudes_promocion enable row level security;
alter table public.solicitud_promocion_items enable row level security;
alter table public.pagos_promocion enable row level security;
alter table public.promociones_activas enable row level security;
alter table public.eventos_promocion enable row level security;

revoke all on table
  public.promocion_productos,
  public.solicitudes_promocion,
  public.solicitud_promocion_items,
  public.pagos_promocion,
  public.promociones_activas,
  public.eventos_promocion
from anon, authenticated;

-- Catalogo inicial version 1. El combo se forma con ambos componentes.
insert into public.promocion_productos
  (codigo, tipo, nombre, precio_centavos, moneda, duracion_dias, version, activo)
values
  ('DEST-30', 'destacado', 'Aviso destacado', 29900, 'MXN', 30, 1, true),
  ('URG-7', 'urgente', 'Aviso urgente', 9900, 'MXN', 7, 1, true)
on conflict (codigo) do nothing;

commit;

-- NOTAS PARA LA SIGUIENTE REVISION:
-- 1. Las funciones RPC aun no estan incluidas.
-- 2. La unicidad de promociones vigentes por aviso/tipo queda respaldada por indice
--    unico parcial; la RPC debe bloquear el aviso y marcar expiraciones antes de insertar.
-- 3. El indice de pagos permite un solo pago verificado por solicitud; los intentos observados/rechazados se conservan.
-- 4. Comprobante verificado: activada_at + interval '7 days'. Observado/rechazado: revisado_at + interval '7 days'.
--    La retencion suspendida bloquea el borrado hasta resolver la incidencia.
-- 5. Regla aprobada: cancelar por RPC solo en pendiente_revision/requiere_ajustes; propietario únicamente, con bloqueo transaccional y bitácora.
-- 6. La RPC cancelar_solicitud_promocion aún debe implementarse y probarse.
-- 7. No crear el bucket privado ni cron/Edge Function en esta migracion.
