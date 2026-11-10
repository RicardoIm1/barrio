# Estado de implementación de RPC del módulo de promociones

## Estado

Primera entrega de funciones SQL propuesta en la rama `feature/promociones-aprobadas`.

Archivo: `sql/002_rpc_propuesta_parcial.sql`

**No se ha ejecutado en Supabase ni se ha validado en un motor PostgreSQL real.** Es una propuesta de implementación que requiere pruebas aisladas antes de cualquier migración.

## Funciones incluidas

| RPC | Quién puede invocarla | Responsabilidad |
|---|---|---|
| `solicitar_promocion` | Usuario autenticado | Verifica propiedad y estado activo del aviso, consulta catálogo en servidor, calcula total y crea solicitud con snapshots |
| `reenviar_solicitud_promocion` | Propietario | Reenvía una solicitud en `requiere_ajustes` |
| `cancelar_solicitud_promocion` | Propietario | Cancela solo `pendiente_revision` o `requiere_ajustes`, con motivo obligatorio |
| `revisar_solicitud_promocion` | Administrador activo | Aprueba, solicita ajustes o rechaza |
| `activar_promocion` | Administrador activo | Exige pago verificado, vuelve a comprobar el aviso, crea todos los componentes en una transacción y fija retención del comprobante |
| `vencer_promociones` | Ejecutor de sistema confiable | Marca componentes vencidos y cierra la solicitud cuando todos los componentes vencieron |

## Controles incluidos en el SQL

- `SECURITY DEFINER` solo donde es necesario para operar sobre tablas sin grants directos.
- `search_path = ''` en todas las funciones y referencias cualificadas.
- Revocación de `EXECUTE` a `PUBLIC`, `anon`, `authenticated` y `service_role`; concesión a `authenticated` solo para las cinco RPC de usuario/administrador.
- Las funciones administrativas validan `private.es_admin()`; el rol moderador no obtiene facultades comerciales.
- Validación de `auth.uid()` y propiedad del aviso/solicitud.
- Bloqueo de aviso antes de solicitud en la activación.
- Activación atómica de los componentes, con vencimientos independientes derivados de los snapshots.
- Bloqueo asesorado para evitar dos procesos simultáneos de vencimiento.
- Bitácora de cambios dentro de la misma transacción.
- Ninguna escritura sobre `public.avisos`, `urgente`, `destacado` o `campanas_destacado`.

## Pendiente y deliberadamente fuera de esta primera entrega

No se han implementado todavía las RPC de pago ni el ciclo de Storage:

1. Reservar una ruta privada de comprobante antes de la carga.
2. Crear el intento de pago en estado `pendiente_carga`.
3. Cargar el archivo al bucket privado, aún no creado.
4. Validar MIME real, bytes y SHA-256 en servidor.
5. Cambiar de forma atómica `estado_carga` a `validado` y `estado_pago` a `reportado`.
6. Revisar/observar/rechazar/verificar el pago por administrador.
7. Al observar o rechazar, establecer la retención de 7 días desde la decisión.
8. Al verificar, mantener la elegibilidad de borrado sin fecha hasta la activación; al activar, fijar activación + 7 días.
9. Implementar el borrado por Storage API y la suspensión por controversia o revisión administrativa.

No debe habilitarse contratación real hasta que el ciclo completo de pagos, comprobantes, lecturas seguras y retención esté implementado y probado.

## Revisión técnica requerida antes de ejecutar

- Probar que el propietario real de las funciones puede acceder a las tablas comerciales y a `private.es_admin()` sin abrir grants directos a clientes.
- Validar los tipos y firmas de `auth.uid()`, `private.es_admin()` y `pg_try_advisory_xact_lock` en el PostgreSQL del proyecto.
- Ejecutar pruebas concurrentes para solicitud, cancelación/aprobación y activación.
- Probar usuario A, usuario B, moderador, administrador, anon y ejecutor de sistema.
- Probar que una solicitud con paquete destacado + urgente crea dos componentes y conserva 30/7 días.
- Probar aviso no activo después del pago verificado: debe quedar en `revision_administrativa`, sin crear promociones.
- Probar que el proceso de vencimiento no modifica ningún campo de `public.avisos`.
- Ejecutar Supabase Advisors y revisar los permisos efectivos.
- Confirmar configuración de Data API y el límite global de Storage en Dashboard antes de la fase de despliegue.

## Zona protegida

No modificar como parte del módulo:

- `admin.html`
- `js/admin.js`
- Los checks administrativos existentes Urgente y Destacado
- `public.avisos` y sus triggers
- `campanas_destacado`
- Bucket `media` y sus policies

Las promociones comerciales permanecen en sus propias tablas. La futura presentación en portada podrá combinar señales comerciales y administrativas sin sobrescribirlas.

## Referencias de diseño

- `DISENO-RPCS-Y-CONCURRENCIA.md`
- `DISENO-DATOS-Y-ESTADOS.md`
- `DISENO-STORAGE-COMPROBANTES.md`
- `AUDITORIA-STORAGE-DATA-API.md`
- `REVISION-PERMISOS-Y-CONCURRENCIA.md`

## Documentación Supabase consultada

- Database Functions: https://supabase.com/docs/guides/database/functions
- Cron: https://supabase.com/docs/guides/cron
- Scheduling Edge Functions: https://supabase.com/docs/guides/functions/schedule-functions

La documentación vigente recomienda fijar `search_path` vacío en funciones `SECURITY DEFINER`, cualificar nombres, restringir explícitamente `EXECUTE` y usar Vault para credenciales de invocación programada. La implementación de Cron/Edge Function no forma parte de este archivo.


## Siguiente capa: comprobantes y pagos

El ciclo de carga y revisión se documenta ahora en `ESTADO-IMPLEMENTACION-COMPROBANTES.md`, con SQL separado `sql/003_comprobantes_y_revision_pagos.sql` y Edge Function `supabase/functions/comprobantes-promocion/index.ts`.

Esta capa sigue siendo propuesta no desplegada. Las funciones de la primera entrega y las nuevas RPC deberán probarse juntas en una base aislada, especialmente los estados compartidos de solicitud y pago.
