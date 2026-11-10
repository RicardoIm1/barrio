# Módulo de promociones de El Barrio

## Estado
Diseño inicial. Esta rama parte de `main` y mantiene aislado el desarrollo comercial.

## Objetivo
Permitir que una persona solicite promocionar uno de sus avisos mediante los productos **Destacado** y **Urgente**, con autorización editorial previa, pago manual y activación controlada por administración.

## Límite de seguridad
- No modificar `admin.html`, `js/admin.js` ni el flujo actual de edición de avisos.
- No retirar ni alterar los checks administrativos existentes `urgente` y `destacado`.
- No escribir desde el navegador directamente en esos campos como parte del flujo comercial.
- No modificar políticas, triggers, funciones ni tablas actuales hasta terminar la inspección y aprobar una migración revisada.
- No reutilizar ni eliminar `campanas_destacado` sin una decisión explícita basada en su uso real.
- No modificar la tabla de avisos, su contenido, métricas, comentarios, reacciones o medios para representar una promoción.

## Catálogo comercial
Consultar CATALOGO-COMERCIAL.md para precios y duraciones iniciales: Destacado $299 MXN por 30 días, Urgente $99 MXN por 7 días y paquete combinado $398 MXN con ambas duraciones independientes. El paquete combinado no tiene descuento de lanzamiento.

## Diseño de datos y estados
Consultar [DISENO-DATOS-Y-ESTADOS.md](./DISENO-DATOS-Y-ESTADOS.md) para la propuesta de entidades, reglas de acceso, estados, transiciones y funciones servidor. Es un diseño para revisión; todavía no hay migraciones ni cambios en Supabase.

## Modelo funcional previsto
1. El propietario elige uno de sus avisos y solicita Destacado, Urgente o ambos.
2. Elige un paquete y consulta precio, duración y condiciones.
3. La solicitud queda pendiente de revisión.
4. Administración aprueba, rechaza o solicita ajustes.
5. Si se aprueba, el usuario realiza transferencia o depósito y reporta el pago con comprobante.
6. Administración verifica el pago.
7. Administración activa la promoción. La vigencia comienza en ese momento.
8. El sistema registra la expiración y conserva el historial.

La solicitud, autorización y pago no activan por sí solos la promoción. La activación requiere una acción administrativa posterior a la verificación del pago.

## Separación de componentes
- Interfaz de usuario: `promocionar.html`.
- Consola administrativa comercial: `promociones-admin.html`.
- Lógica exclusiva del módulo: `js/promociones.js`.
- Esquema y migraciones: se incorporarán después de inspeccionar tipos, relaciones, RLS, grants, triggers y funciones existentes.

Los nombres anteriores son objetivos de diseño, no archivos desplegados todavía.

## Principios de datos y seguridad
- Cada solicitud debe validar en servidor que el usuario autenticado es propietario del aviso.
- La autorización y la validación del pago deben comprobar el rol administrativo real en servidor, no confiar en datos de `localStorage`.
- Las operaciones sensibles se implementarán mediante funciones seguras con permisos mínimos.
- Los comprobantes deberán almacenarse en un bucket privado separado de los medios públicos de avisos.
- Se guardarán snapshots de producto, paquete, precio, moneda y duración para conservar los términos aceptados.
- Se registrará un historial auditable de solicitudes, decisiones, pagos y activaciones.
- Una promoción comercial no debe sobrescribir los distintivos administrativos existentes.
- Destacado y Urgente podrán coexistir para un mismo aviso, con vigencias independientes.

## Integración futura en portada
La lectura de promociones vigentes se integrará de forma independiente. Antes de cambiar el orden o presentación del feed se deberá documentar la consulta actual, probar la nueva lectura y comprobar que los avisos con distintivos administrativos continúan comportándose igual.

## Punto de retorno
La rama `main` y el administrador actual constituyen la referencia funcional. Si una integración posterior altera el formulario de edición, sus checks o el guardado administrativo de Urgente/Destacado, se detiene la integración y se restaura el comportamiento de referencia.

## No incluido en esta etapa
- Migraciones SQL ejecutadas.
- Cambios en producción o despliegue.
- Cambios en `admin.html` o `js/admin.js`.
- Cambios en la portada.
- Cobros automáticos o pasarela de pago.


## Diseño de RPC y concurrencia

Consulta [`DISENO-RPCS-Y-CONCURRENCIA.md`](./DISENO-RPCS-Y-CONCURRENCIA.md) para los contratos de las funciones, controles de acceso, concurrencia y matriz de pruebas.

## Storage privado de comprobantes

Consulta [`DISENO-STORAGE-COMPROBANTES.md`](./DISENO-STORAGE-COMPROBANTES.md) para el bucket privado, rutas, permisos, retención y pruebas. Los límites aprobados son 5,000,000 bytes por archivo, MIME JPEG/PNG/WebP/PDF, un archivo por intento y sin sobrescritura. El usuario únicamente consulta el estado del pago; el administrador activo accede temporalmente al comprobante para verificarlo. No se integrará antivirus externo en la primera versión. La configuración real sigue pendiente de implementación y pruebas.


## Flujo de carga y validación de comprobantes

Consulta [DISENO-CARGA-VALIDACION.md](./DISENO-CARGA-VALIDACION.md) para la secuencia de reserva, carga privada, validación de contenido en servidor, recuperación de fallos y pruebas. Se aprobó el límite exacto de 5,000,000 bytes y que el usuario no descargue el comprobante, sino que consulte el estado del pago. No se contratará análisis antimalware externo en la primera versión. Es diseño únicamente; no se han creado funciones ni políticas. Las reservas incompletas vencen a los 30 minutos y una limpieza automática diaria retirará las reservas vencidas no validadas y sus objetos huérfanos mediante Storage API.


## Auditoría de Storage y Data API

Consulta [AUDITORIA-STORAGE-DATA-API.md](./AUDITORIA-STORAGE-DATA-API.md) para los resultados de inspección de solo lectura. Se observó un único bucket público `media` con límite de 10 MiB; el límite global configurado no pudo verificarse mediante SQL. También se identificaron privilegios por defecto amplios para tablas, funciones y secuencias nuevas en `public`, por lo que la futura migración deberá revocarlos expresamente y conceder solo permisos mínimos. No se modificó Supabase.


## Revisión de permisos y concurrencia

Consulta [REVISION-PERMISOS-Y-CONCURRENCIA.md](./REVISION-PERMISOS-Y-CONCURRENCIA.md) para los hallazgos del borrador SQL, el orden obligatorio de bloqueo y los requisitos de privilegios mínimos. Se corrigió el diseño documental de activación para bloquear aviso → solicitud. No se ejecutó SQL ni se modificó Supabase.


## Esquema SQL revisado

El archivo [001_esquema_base_propuesta.sql](./sql/001_esquema_base_propuesta.sql) fue endurecido como propuesta documental: seis tablas, relaciones compuestas para evitar referencias cruzadas, separación entre estado del pago y estado de carga, retención y RLS desde la creación, y revocaciones explícitas a `PUBLIC`, `anon`, `authenticated` y `service_role`. No incluye RPC, policies, bucket ni tareas programadas. No se ha ejecutado ni probado contra una base aislada; no es una migración lista para producción.


## Estado de las RPC

Se agregó una primera propuesta de funciones en `sql/002_rpc_propuesta_parcial.sql`, documentada en `ESTADO-IMPLEMENTACION-RPC.md`.

Incluye solicitud, reenvío, cancelación, revisión administrativa, activación y vencimiento. **No incluye aún el ciclo de comprobantes y pagos**, por lo que no está habilitada para contratación real ni debe ejecutarse en producción. Requiere validación PostgreSQL aislada y pruebas de permisos/concurrencia.

La zona administrativa existente permanece protegida: no se modifican `admin.html`, `js/admin.js`, los flags de aviso ni el bucket `media`.
