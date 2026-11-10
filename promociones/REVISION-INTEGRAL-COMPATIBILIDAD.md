# Revisión integral de compatibilidad del módulo de promociones

Fecha: 10 de noviembre de 2026  
Rama: `feature/promociones-aprobadas`

## Resultado

**Compatibilidad documental y estática: revisada con una corrección de permisos aplicada.**  
**Ejecución PostgreSQL, pruebas concurrentes y compilación Deno/TypeScript: pendientes.**  
**No ejecutar en producción ni habilitar contratación real todavía.**

## Archivos revisados

1. `promociones/sql/001_esquema_base_propuesta.sql`
2. `promociones/sql/002_rpc_propuesta_parcial.sql`
3. `promociones/sql/003_comprobantes_y_revision_pagos.sql`
4. `promociones/sql/004_retencion_y_limpieza.sql`
5. `supabase/functions/comprobantes-promocion/index.ts`
6. `supabase/functions/limpiar-comprobantes-promocion/index.ts`
7. `supabase/config.toml`

**Aclaración de rutas:** la segunda migración sí existe y su nombre real es `002_rpc_propuesta_parcial.sql`. No es `002_rpcs_y_concurrencia.sql`.

## Compatibilidad entre las cuatro migraciones

- 001 define las seis tablas comerciales, estados, restricciones e índices utilizados por 002, 003 y 004.
- 002 crea solicitud, reenvío, cancelación, revisión administrativa, activación y vencimiento.
- 003 utiliza los estados `aprobada_pendiente_pago`, `pago_observado`, `pago_reportado` y `pago_verificado`, presentes en el CHECK de `solicitudes_promocion`.
- 003 mantiene separados `estado_pago` y `estado_carga`, conforme a las restricciones de `pagos_promocion` de 001.
- 004 usa las columnas de retención, borrado y reintento definidas en 001.
- El orden de bloqueo de las operaciones que necesitan varias entidades sigue aviso → solicitud → pago. Las operaciones de limpieza bloquean únicamente pagos y no intentan adquirir después los bloqueos de aviso o solicitud.
- La activación crea una fila por componente, usa snapshots de duración y no escribe en `public.avisos`, sus flags ni `campanas_destacado`.
- Los comprobantes se eliminan mediante Storage API; no se usa DELETE SQL sobre `storage.objects`.

## Corrección aplicada

Se detectó que la policy de INSERT de `storage.objects` invoca `private.puede_cargar_comprobante_promocion(text,text)`, pero el SQL revocaba EXECUTE a todos los roles y no lo concedía a `authenticated`. En ese estado, el usuario autenticado no podría ejecutar la expresión de autorización de la policy.

Corregido en `promociones/sql/003_comprobantes_y_revision_pagos.sql`:

- Se concede USAGE del esquema `private` a `authenticated`.
- Se concede EXECUTE únicamente sobre el helper de autorización de carga.
- El helper permanece `SECURITY DEFINER`, con `search_path = ''`, y valida usuario, bucket, ruta reservada, propietario, estado y vencimiento.
- No se concede acceso directo a ninguna tabla comercial.

Commit de la corrección: `f31ad7a562907c91c2c43caa33bd1ec7fa2533bb`.

## Controles de seguridad revisados

- Tablas comerciales sin CRUD directo para `anon`, `authenticated` ni `service_role`.
- RPC de usuario y administración con autorización dentro de funciones `SECURITY DEFINER`.
- Funciones de servicio reservadas a `service_role`.
- Revisión administrativa requiere `private.es_admin()`; moderador no obtiene privilegios comerciales.
- Bucket esperado `comprobantes-promociones` privado, distinto de `media`.
- Policy nueva limitada a INSERT y a la ruta reservada.
- URL firmada para administrador con vigencia de 90 segundos.
- Limpieza programada protegida por secreto dedicado y sin JWT de usuario.
- Retención suspendible por controversia o revisión.
- Configuración de `send-push` debe permanecer intacta.

## Pendientes antes de cualquier despliegue

1. Probar las cuatro migraciones, en orden, en PostgreSQL aislado con una copia de esquema compatible y sin datos personales.
2. Confirmar propietario efectivo de las funciones y que ese propietario tiene los permisos necesarios sobre las tablas comerciales y `private.es_admin()`.
3. Ejecutar pruebas de roles: anon, usuario propietario, otro usuario, moderador, administrador activo, administrador inactivo y service_role.
4. Probar carreras de solicitud, aprobación/cancelación, reporte/revisión de pago, activación y limpieza.
5. Probar Storage real en un proyecto de pruebas: carga de ruta reservada, denegación de ruta ajena, ausencia de SELECT/UPDATE/DELETE y borrado físico.
6. Compilar y probar ambas Edge Functions con Deno/Supabase CLI.
7. Revisar todas las policies actuales de `storage.objects`, porque las policies PERMISSIVE se combinan mediante OR.
8. Confirmar en Dashboard el límite global de Storage y la configuración Data API.
9. Configurar secretos, desplegar funciones y programar Cron solo después de superar las pruebas y con autorización expresa.

## Fuera de alcance y protegidos

No se modificaron ni deben modificarse en esta etapa:

- `admin.html`
- `js/admin.js`
- Los checks administrativos existentes Urgente y Destacado
- `public.avisos`, sus triggers y flags
- `campanas_destacado`
- Bucket `media` y sus policies

## Conclusión

La secuencia de archivos y los estados de negocio son coherentes a nivel de inspección estática, y se corrigió el permiso faltante del helper de Storage. Esto **no equivale a validación de sintaxis o ejecución**. El siguiente paso técnico es probar las migraciones en PostgreSQL aislado; después, construir las interfaces independientes de usuario y administración comercial. No desplegar ni activar cobros todavía.
