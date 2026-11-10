-- PROPUESTA DE ESQUEMA BASE. NO EJECUTAR EN PRODUCCION.
-- Rama: feature/promociones-aprobadas
-- Version documental revisada: 2026-11-10
--
-- Alcance:
--   * Crea exclusivamente las seis tablas comerciales del modulo.
--   * No modifica public.avisos, public.usuarios, campanas_destacado,
--     triggers, funciones existentes, Storage ni configuracion Data API.
--   * No crea RPCs, policies, bucket, cron ni Edge Functions.
--
-- Seguridad:
--   * RLS queda habilitado en todas las tablas.
--   * No se concede acceso directo a anon, authenticated ni service_role.
--   * Los permisos se revocan expresamente por objeto para neutralizar
--     los default privileges amplios observados en este proyecto.
--   * Las futuras operaciones de cliente se expondran solo mediante RPC
--     especificas, con autorizacion servidor y EXECUTE minimo.
--
-- Este archivo reemplaza el borrador inicial. Sigue siendo una propuesta
-- y requiere pruebas en una base aislada, revision de dependencias y
-- aprobacion explicita antes de cualquier ejecucion.

begin;

-- ---------------------------------------------------------------------
-- 1. Catalogo versionado
-- ---------------------------------------------------------------------

create table public.promocion_productos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  tipo text not null check (tipo in ('destacado', 'urgente')),
  nombre text not null check (nullif(btrim(nombre), '') is not null),
  precio_centavos integer not null check (precio_centavos > 0),
  moneda text not null default 'MXN' check (moneda = 'MXN'),
  duracion_dias integer not null check (duracion_dias > 0),
  version integer not null default 1 check (version > 0),
  activo boolean not null default true,
  vigente_desde timestamptz,
  vigente_hasta timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_promocion_productos_tipo_version unique (tipo, version),
  constraint ck_promocion_productos_vigencia
    check (vigente_hasta is null or vigente_desde is null or vigente_hasta > vigente_desde)
);

comment on table public.promocion_productos is
  'Catalogo comercial versionado. Los contratos conservan snapshots; los productos se desactivan, no se borran.';

-- ---------------------------------------------------------------------
-- 2. Solicitudes
-- ---------------------------------------------------------------------

create table public.solicitudes_promocion (
  id uuid primary key default gen_random_uuid(),
  aviso_id uuid not null references public.avisos(id) on delete restrict,
  solicitante_id uuid not null references public.usuarios(id) on delete restrict,
  estado text not null default 'pendiente_revision'
    check (estado in (
      'pendiente_revision',
      'requiere_ajustes',
      'rechazada',
      'aprobada_pendiente_pago',
      'pago_reportado',
      'pago_observado',
      'pago_verificado',
      'revision_administrativa',
      'activa',
      'vencida',
      'cancelada'
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
  constraint uq_solicitudes_promocion_id_aviso unique (id, aviso_id),
  constraint ck_solicitud_cancelacion
    check (
      (
        estado = 'cancelada'
        and cancelled_at is not null
        and cancelled_by is not null
        and nullif(btrim(cancellation_reason), '') is not null
      )
      or
      (
        estado <> 'cancelada'
        and cancelled_at is null
        and cancelled_by is null
        and cancellation_reason is null
      )
    )
);

comment on table public.solicitudes_promocion is
  'Cabecera comercial. La propiedad del aviso y las transiciones se validan en RPC servidor; no hay escritura directa desde clientes.';

-- ---------------------------------------------------------------------
-- 3. Componentes contratados y snapshots inmutables
-- ---------------------------------------------------------------------

create table public.solicitud_promocion_items (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes_promocion(id) on delete restrict,
  producto_id uuid references public.promocion_productos(id) on delete restrict,
  tipo_snapshot text not null check (tipo_snapshot in ('destacado', 'urgente')),
  nombre_snapshot text not null check (nullif(btrim(nombre_snapshot), '') is not null),
  precio_centavos_snapshot integer not null check (precio_centavos_snapshot > 0),
  moneda_snapshot text not null default 'MXN' check (moneda_snapshot = 'MXN'),
  duracion_dias_snapshot integer not null check (duracion_dias_snapshot > 0),
  created_at timestamptz not null default now(),
  constraint uq_solicitud_item_tipo unique (solicitud_id, tipo_snapshot),
  constraint uq_solicitud_item_id_solicitud unique (id, solicitud_id)
);

comment on table public.solicitud_promocion_items is
  'Cada fila es un componente. Precio, nombre, moneda y duración son snapshots del momento de contratación.';

-- ---------------------------------------------------------------------
-- 4. Intentos y revisiones de pago
-- ---------------------------------------------------------------------

create table public.pagos_promocion (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes_promocion(id) on delete restrict,
  reportado_por uuid not null references public.usuarios(id) on delete restrict,
  importe_centavos_reportado integer not null check (importe_centavos_reportado > 0),
  moneda text not null default 'MXN' check (moneda = 'MXN'),

  -- estado_pago y estado_carga son dimensiones separadas:
  -- el pago no pasa a reportado hasta que la Edge Function valide el objeto.
  estado_pago text not null default 'pendiente'
    check (estado_pago in ('pendiente', 'reportado', 'observado', 'verificado', 'rechazado')),
  estado_carga text not null default 'pendiente_carga'
    check (estado_carga in ('pendiente_carga', 'validando', 'validado', 'invalido', 'error', 'expirada')),

  comprobante_path text not null unique,
  mime_declarado text,
  mime_detectado text,
  bytes_comprobante bigint check (bytes_comprobante is null or bytes_comprobante between 1 and 5000000),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),

  referencia_operacion text,
  observacion_admin text,

  reservado_at timestamptz not null default now(),
  reserva_expira_at timestamptz not null default (now() + interval '30 minutes'),
  cargado_at timestamptz,
  validado_at timestamptz,
  reportado_at timestamptz,
  revisado_at timestamptz,
  revisado_por uuid references public.usuarios(id) on delete restrict,

  -- Retención: verificado = activación + 7 días;
  -- observado/rechazado = decisión administrativa + 7 días.
  comprobante_eliminar_despues_de timestamptz,
  comprobante_eliminado_at timestamptz,
  retencion_suspendida boolean not null default false,
  retencion_motivo text,
  retencion_liberada_at timestamptz,
  retencion_liberada_por uuid references public.usuarios(id) on delete restrict,
  ultimo_intento_borrado_at timestamptz,
  ultimo_error_borrado text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_pago_id_solicitud unique (id, solicitud_id),
  constraint ck_pago_reserva check (reserva_expira_at > reservado_at),
  constraint ck_pago_validado_metadata
    check (
      estado_carga <> 'validado'
      or (
        validado_at is not null
        and reportado_at is not null
        and mime_detectado in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
        and bytes_comprobante between 1 and 5000000
        and sha256 is not null
      )
    ),
  constraint ck_pago_reportado_carga
    check (estado_pago not in ('reportado', 'observado', 'verificado', 'rechazado') or estado_carga = 'validado'),
  constraint ck_pago_revision
    check (
      estado_pago not in ('observado', 'verificado', 'rechazado')
      or (revisado_at is not null and revisado_por is not null)
    ),
  constraint ck_pago_retencion_suspendida
    check (
      (retencion_suspendida and nullif(btrim(retencion_motivo), '') is not null)
      or not retencion_suspendida
    ),
  constraint ck_pago_retencion_liberada
    check (
      (retencion_liberada_at is null and retencion_liberada_por is null)
      or (retencion_liberada_at is not null and retencion_liberada_por is not null)
    ),
  constraint ck_pago_comprobante_eliminado
    check (
      comprobante_eliminado_at is null
      or comprobante_eliminar_despues_de is not null
    )
);

comment on table public.pagos_promocion is
  'Cada reserva/carga validada genera un intento independiente. El binario vive en Storage privado; aquí permanecen metadatos y auditoría.';

-- ---------------------------------------------------------------------
-- 5. Vigencias por componente
-- ---------------------------------------------------------------------

create table public.promociones_activas (
  id uuid primary key default gen_random_uuid(),
  solicitud_item_id uuid not null unique,
  solicitud_id uuid not null,
  aviso_id uuid not null,
  tipo text not null check (tipo in ('destacado', 'urgente')),
  estado text not null default 'activa'
    check (estado in ('programada', 'activa', 'vencida', 'cancelada')),
  activada_at timestamptz not null,
  vence_at timestamptz not null,
  activada_por uuid not null references public.usuarios(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fk_promocion_item_solicitud
    foreign key (solicitud_item_id, solicitud_id)
    references public.solicitud_promocion_items(id, solicitud_id) on delete restrict,
  constraint fk_promocion_solicitud_aviso
    foreign key (solicitud_id, aviso_id)
    references public.solicitudes_promocion(id, aviso_id) on delete restrict,
  constraint uq_promocion_id_solicitud unique (id, solicitud_id),
  constraint ck_promocion_fechas check (vence_at > activada_at)
);

comment on table public.promociones_activas is
  'Una fila por componente activado. No modifica public.avisos.urgente ni public.avisos.destacado.';

-- ---------------------------------------------------------------------
-- 6. Bitácora append-only
-- ---------------------------------------------------------------------

create table public.eventos_promocion (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes_promocion(id) on delete restrict,
  solicitud_item_id uuid,
  pago_id uuid,
  promocion_id uuid,
  actor_id uuid references public.usuarios(id) on delete restrict,
  actor_tipo text not null check (actor_tipo in ('usuario', 'admin', 'sistema')),
  evento text not null check (nullif(btrim(evento), '') is not null),
  estado_anterior text,
  estado_nuevo text,
  detalle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint fk_evento_item_solicitud
    foreign key (solicitud_item_id, solicitud_id)
    references public.solicitud_promocion_items(id, solicitud_id) on delete restrict,
  constraint fk_evento_pago_solicitud
    foreign key (pago_id, solicitud_id)
    references public.pagos_promocion(id, solicitud_id) on delete restrict,
  constraint fk_evento_promocion_solicitud
    foreign key (promocion_id, solicitud_id)
    references public.promociones_activas(id, solicitud_id) on delete restrict,
  constraint ck_evento_actor
    check (
      (actor_tipo = 'sistema' and actor_id is null)
      or (actor_tipo in ('usuario', 'admin') and actor_id is not null)
    ),
  constraint ck_evento_detalle_objeto
    check (jsonb_typeof(detalle) = 'object')
);

comment on table public.eventos_promocion is
  'Bitácora append-only. El JSON solo admite datos operativos no sensibles; nunca comprobantes, URLs firmadas, tokens o secretos.';

-- ---------------------------------------------------------------------
-- 7. Índices
-- ---------------------------------------------------------------------

create index idx_solicitudes_promocion_aviso
  on public.solicitudes_promocion (aviso_id, created_at desc);
create index idx_solicitudes_promocion_solicitante
  on public.solicitudes_promocion (solicitante_id, created_at desc);
create index idx_solicitudes_promocion_estado
  on public.solicitudes_promocion (estado);

create index idx_items_promocion_solicitud
  on public.solicitud_promocion_items (solicitud_id);

create index idx_pagos_promocion_solicitud
  on public.pagos_promocion (solicitud_id, reservado_at desc);
create index idx_pagos_promocion_retencion
  on public.pagos_promocion (comprobante_eliminar_despues_de)
  where comprobante_eliminado_at is null
    and comprobante_path is not null;
create index idx_pagos_promocion_reservas
  on public.pagos_promocion (reserva_expira_at)
  where estado_carga in ('pendiente_carga', 'validando', 'error');

create index idx_promociones_activas_aviso_tipo_estado
  on public.promociones_activas (aviso_id, tipo, estado, vence_at);

-- Defensa final contra dos promociones vigentes del mismo tipo y aviso.
-- La RPC bloquea aviso -> solicitud, marca vencidas y después inserta.
create unique index uq_promociones_activas_aviso_tipo_vigente
  on public.promociones_activas (aviso_id, tipo)
  where estado in ('programada', 'activa');

-- Un solo pago verificado por solicitud. Intentos observados/rechazados se conservan.
create unique index uq_pagos_promocion_un_verificado
  on public.pagos_promocion (solicitud_id)
  where estado_pago = 'verificado';

create index idx_eventos_promocion_solicitud
  on public.eventos_promocion (solicitud_id, created_at desc);

-- ---------------------------------------------------------------------
-- 8. RLS y privilegios explícitos
-- ---------------------------------------------------------------------

alter table public.promocion_productos enable row level security;
alter table public.solicitudes_promocion enable row level security;
alter table public.solicitud_promocion_items enable row level security;
alter table public.pagos_promocion enable row level security;
alter table public.promociones_activas enable row level security;
alter table public.eventos_promocion enable row level security;

-- No se crean policies en esta etapa. Sin grants, los roles API no pueden
-- acceder directamente. Las futuras RPC serán puntos de entrada específicos.
-- Se revocan también privilegios a service_role: los procesos privilegiados
-- usarán funciones/credenciales servidor deliberadamente autorizadas, no acceso
-- CRUD general a estas tablas.
revoke all privileges on table
  public.promocion_productos,
  public.solicitudes_promocion,
  public.solicitud_promocion_items,
  public.pagos_promocion,
  public.promociones_activas,
  public.eventos_promocion
from public, anon, authenticated, service_role;

-- No se altera ALTER DEFAULT PRIVILEGES global del proyecto.
-- No se crean secuencias propias: todas las PK usan UUID.
-- Cada función futura debe revocar EXECUTE de PUBLIC, anon y authenticated
-- expresamente y concederlo solo al rol de invocación requerido.

-- ---------------------------------------------------------------------
-- 9. Catalogo inicial
-- ---------------------------------------------------------------------

insert into public.promocion_productos
  (codigo, tipo, nombre, precio_centavos, moneda, duracion_dias, version, activo)
values
  ('DEST-30', 'destacado', 'Aviso destacado', 29900, 'MXN', 30, 1, true),
  ('URG-7', 'urgente', 'Aviso urgente', 9900, 'MXN', 7, 1, true);

commit;

-- ---------------------------------------------------------------------
-- 10. Contratos que deben cumplir las futuras RPC
-- ---------------------------------------------------------------------
-- A. Nunca aceptar del navegador solicitante_id, precio, moneda, duración,
--    tipo de aviso, estado administrativo ni ruta de Storage arbitraria.
-- B. La RPC de solicitud bloquea public.avisos FOR UPDATE, valida created_by
--    contra auth.uid(), status='activo', catálogo vigente y duplicidad.
-- C. Operaciones que necesiten aviso y solicitud usan orden fijo:
--    lectura preliminar aviso_id sin lock; lock aviso; lock solicitud;
--    revalidar relación, identidad y estados después de ambos locks.
-- D. activar_promocion exige admin activo mediante private.es_admin(),
--    pago verificado, importe exacto y aviso aún activo. Si no, deriva a
--    revision_administrativa sin crear componentes.
-- E. La activación es atómica para todos los componentes del paquete.
--    destacado/urgente tienen vence_at independiente desde activada_at.
-- F. cancelar_solicitud_promocion solo permite al propietario cancelar
--    pendiente_revision/requiere_ajustes; motivo obligatorio y evento.
-- G. El vencimiento no altera public.avisos.urgente ni .destacado.
-- H. Los archivos se borran por Storage API, nunca DELETE SQL sobre
--    storage.objects. La retención aprobada es de 7 días naturales.
-- I. Las RPC de cliente deben ser funciones públicas deliberadas con
--    SECURITY DEFINER, search_path vacío, nombres cualificados, validación
--    explícita de auth.uid()/rol y EXECUTE revocado a PUBLIC/anon por defecto.
--    Las funciones internas viven en esquema no expuesto. Preferir INVOKER
--    siempre que los grants permitan hacerlo sin abrir tablas al cliente.
-- J. Esta propuesta no incluye aún las RPC, policies, bucket, Edge Functions,
--    Cron ni tests de integración. No ejecutar hasta cerrar esos componentes.
