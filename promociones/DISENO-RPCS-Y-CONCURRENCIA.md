# Diseño de RPC, concurrencia y seguridad del módulo de promociones

## Estado
Diseño técnico propuesto para revisión. No contiene migraciones ejecutables ni se ha aplicado a Supabase. Rama: `feature/promociones-aprobadas`.

## 1. Arquitectura de invocación

Se propone separar la superficie pública de API de las funciones privilegiadas:

- Funciones internas en el esquema no expuesto `private`, con `SECURITY DEFINER`, `SET search_path = ''`, nombres de tablas y funciones cualificados y validaciones explícitas de identidad.
- RPC públicas deliberadas y delgadas en `public`, con `SECURITY DEFINER` solo si deben operar sobre tablas sin grants directos al cliente. Cada una debe fijar `search_path = ''`, validar `auth.uid()` y autorización dentro del cuerpo, y delegar en lógica interna. Preferir `SECURITY INVOKER` cuando los grants permitan hacerlo sin abrir tablas al navegador.
- `EXECUTE` revocado expresamente de `PUBLIC`, `anon` y `authenticated` en todas las funciones nuevas; concedido solo a los roles que deban invocar cada RPC. No asumir que el esquema privado por sí solo elimina privilegios de ejecución.
- El esquema `private` no se expone en la API REST.
- Cada función interna comprueba `auth.uid()` cuando la operación depende de un usuario. No se confía en IDs de usuario enviados por el navegador.
- La función administrativa valida `private.es_admin()` y no considera a moderadores como administradores.
- Las funciones de sistema, como vencimiento, no reciben permisos de ejecución de `anon` ni `authenticated`; solo se ejecutan desde el mecanismo programado autorizado.

La razón para no publicar funciones `SECURITY DEFINER` directamente es reducir la superficie de privilegios elevados expuesta por PostgREST. La capa pública debe ser mínima y la función interna debe validar cada operación.

## 2. RPC previstas y contratos

### Usuario autenticado

#### `solicitar_promocion(p_aviso_id uuid, p_productos uuid[])`
1. Exige sesión válida.
2. Bloquea la fila del aviso con `SELECT ... FOR UPDATE`.
3. Comprueba que el aviso existe, pertenece a `auth.uid()` y conserva `status = 'activo'`.
4. Exige uno o dos productos, sin IDs repetidos y sin repetir el tipo comercial.
5. Consulta el catálogo vigente y activo; el precio, moneda, duración y nombre provienen exclusivamente de la base de datos.
6. Rechaza la solicitud si ya existe una promoción del mismo tipo para ese aviso con estado vigente y `vence_at > now()`.
7. Crea cabecera, componentes snapshot y evento de auditoría en una sola transacción.
8. Devuelve un resumen no sensible de la solicitud recién creada.

La validación del aviso bloqueado serializa solicitudes concurrentes para el mismo aviso. Una solicitud pendiente no se considera promoción vigente; la verificación se repite al activar para resolver posibles solicitudes paralelas.

#### `reenviar_solicitud_promocion(p_solicitud_id uuid, p_nota text)`
1. Exige sesión válida y propiedad de la solicitud.
2. Bloquea la fila de solicitud.
3. Solo acepta `requiere_ajustes`.
4. Cambia a `pendiente_revision`, actualiza la nota y registra el evento.
5. No permite modificar productos, precio, moneda ni duración del snapshot. Si el usuario necesita otro paquete, debe cancelar antes de la aprobación y crear una solicitud nueva.

#### `cancelar_solicitud_promocion(p_solicitud_id uuid, p_motivo text)`
1. Exige sesión válida y propiedad de la solicitud.
2. Bloquea la fila con `SELECT ... FOR UPDATE`.
3. Solo acepta `pendiente_revision` o `requiere_ajustes`.
4. Cambia a `cancelada`, registra fecha, actor y motivo y agrega evento.
5. Si una revisión administrativa ganó la carrera y ya aprobó la solicitud, la cancelación falla sin modificarla.
6. No borra solicitud, componentes ni bitácora.

#### `reportar_pago_promocion(p_solicitud_id uuid, p_importe_centavos integer, p_comprobante_path text, p_referencia text)`
1. Exige sesión válida, propiedad y estado `aprobada_pendiente_pago` o `pago_observado`.
2. Comprueba que el objeto existe en el bucket privado esperado, que la ruta pertenece al usuario y a esa solicitud y que el archivo cumple límites de tamaño y MIME.
3. El path se valida en servidor; no se acepta una URL pública ni una ruta arbitraria.
4. Crea un intento de pago y evento, sin sustituir reportes previos.
5. No marca el pago como verificado ni activa la promoción.
6. Cada intento conserva su propio comprobante y fecha de retención; el envío de un intento nuevo no elimina ni reinicia la retención del anterior.

La subida del archivo es una operación de Storage separada, con policies propias. La RPC solo registra un objeto que ya existe y cuya ruta puede validar.

### Administrador autenticado

Todas estas funciones comprueban `private.es_admin()`, bloquean la fila de solicitud o pago afectada y registran un evento dentro de la misma transacción.

#### `revisar_solicitud_promocion(p_solicitud_id uuid, p_decision text, p_nota text)`
Decisiones permitidas:
- `aprobar`: solo desde `pendiente_revision`; pasa a `aprobada_pendiente_pago`.
- `solicitar_ajustes`: desde `pendiente_revision`; pasa a `requiere_ajustes`.
- `rechazar`: desde `pendiente_revision` o `requiere_ajustes`; pasa a `rechazada`.

La decisión, nota, actor y timestamp quedan auditados. No modifica el aviso original.

#### `revisar_pago_promocion(p_pago_id uuid, p_decision text, p_nota text)`
Decisiones permitidas:
- `observar`: pago pasa a `estado_pago='observado'` y solicitud a `pago_observado`; fija `comprobante_eliminar_despues_de = revisado_at + interval '7 days'`.
- `rechazar`: pago pasa a `estado_pago='rechazado'` y solicitud vuelve a `aprobada_pendiente_pago`, para permitir un nuevo intento; fija `comprobante_eliminar_despues_de = revisado_at + interval '7 days'`.
- `verificar`: solo si la carga está validada, el importe coincide exactamente con el total aprobado y no existe otro pago verificado para la solicitud. Pago pasa a `estado_pago='verificado'` y solicitud a `pago_verificado`.
- El plazo del comprobante verificado se fija al activar la promoción: `activada_at + interval '7 days'`.

Un índice único parcial sobre pagos con estado `verificado` refuerza la regla de un único pago verificado por solicitud.

#### `activar_promocion(p_solicitud_id uuid)`
1. Exige administrador activo.
2. Lee preliminarmente `aviso_id` desde la solicitud, sin conservar bloqueo.
3. Bloquea la fila del aviso con `SELECT ... FOR UPDATE`.
4. Bloquea la solicitud con `SELECT ... FOR UPDATE`.
5. Revalida que la solicitud siga asociada al mismo aviso, que conserve estado `pago_verificado` y que exista un pago verificado.
5. Revalida que el aviso siga en estado `activo`.
6. Si el aviso ya no está activo, cambia la solicitud a `revision_administrativa`, registra el evento y no crea promociones.
7. Marca como vencidas las promociones del mismo aviso/tipo cuyo `vence_at <= now()`.
8. Comprueba que no quede una promoción vigente del mismo tipo para ese aviso.
9. Crea todas las filas de componentes en una única transacción, con un mismo instante de activación y vencimientos independientes calculados desde sus snapshots.
10. Fija la fecha de elegibilidad de eliminación del comprobante de pago verificado a activación + 7 días naturales.
11. Cambia la solicitud a `activa` y registra el evento.

Si falla cualquier componente, se revierte toda la activación. El índice único parcial sobre `(aviso_id, tipo)` para estados `programada`/ `activa` es una segunda barrera contra duplicados. La RPC debe bloquear primero la fila de `avisos` para serializar activaciones que compiten por el mismo aviso.

### Sistema

#### `vencer_promociones()`
Función interna no expuesta como RPC pública. Se ejecuta por Cron con permisos restringidos.
- Marca `vencida` cada promoción `activa` cuyo `vence_at <= now()`.
- Cambia la solicitud a `vencida` únicamente cuando todos sus componentes hayan terminado.
- Registra eventos idempotentes.
- No modifica `public.avisos.status`, `urgente` ni `destacado`.

## 3. Orden de bloqueo para evitar deadlocks

Para operaciones que necesitan ambas entidades, adoptar un orden fijo:
1. Obtener preliminarmente el `aviso_id` sin conservar bloqueo.
2. Fila de `public.avisos` con `SELECT ... FOR UPDATE`.
3. Fila de `public.solicitudes_promocion` con `SELECT ... FOR UPDATE`.
4. Filas de pagos o componentes en orden determinista por UUID.

La lectura preliminar solo sirve para localizar el aviso. Después de adquirir los bloqueos se debe volver a validar la relación, el propietario, el estado y las condiciones de negocio. En particular, `activar_promocion` debe bloquear aviso → solicitud, nunca solicitud → aviso.

Las operaciones que solo necesitan la solicitud, como cancelar o revisar, pueden bloquear directamente esa fila, pero no deben intentar adquirir después el bloqueo del aviso. Si una operación futura necesita ambas entidades, debe respetar siempre el orden global y no invertirlo.

Las funciones deben ser transaccionales, idempotentes cuando corresponda y usar restricciones únicas como defensa final. No se debe confiar en una consulta previa sin bloqueo.

## 4. Restricciones e índices de defensa

- Un componente de cada tipo por solicitud: `UNIQUE (solicitud_id, tipo_snapshot)`.
- Una promoción activa/programada por aviso y tipo: índice único parcial sobre `(aviso_id, tipo)` para estados `programada` y `activa`.
- Un pago verificado por solicitud: índice único parcial sobre `(solicitud_id)` para estado `verificado`.
- Una promoción por componente contratado: `UNIQUE (solicitud_item_id)`.
- Ruta de comprobante única para impedir reutilizar el mismo objeto en dos pagos.
- Los snapshots son inmutables desde cliente; no se conceden escrituras directas.

La RPC de activación debe marcar como vencidas las filas caducadas antes de insertar, porque el índice parcial observa el estado almacenado, no el paso del reloj.

## 5. Acceso a datos y RLS

- Sin acceso directo para `PUBLIC`, `anon`, `authenticated` ni `service_role` sobre las tablas comerciales en el esquema base. Las credenciales privilegiadas no deben convertirse en un CRUD general del módulo.
- Las lecturas de interfaz se diseñarán después con vistas seguras o RPC de lectura específicas, sin exponer notas internas, rutas privadas, referencias bancarias ni datos de auditoría reservados.
- Si se usan vistas, verificar la semántica de RLS y utilizar `security_invoker = true` cuando corresponda a la versión de PostgreSQL.
- No crear policies amplias sobre tablas comerciales ni policies permisivas que se combinen por OR.
- La administración comercial debe ser una interfaz separada. No modificar `admin.html`, `js/admin.js` ni los checks actuales.

## 6. Matriz mínima de pruebas

1. Usuario no autenticado no puede solicitar, cancelar ni reportar pagos.
2. Usuario A no puede solicitar sobre un aviso de usuario B.
3. Usuario A no puede cancelar ni reportar pago en solicitud de usuario B.
4. Un usuario no puede invocar operaciones administrativas.
5. Moderador no puede aprobar, verificar ni activar.
6. Un usuario no puede cancelar una solicitud aprobada o con pago reportado.
7. Carrera entre cancelación y aprobación: solo una transición gana; la otra falla limpiamente.
8. Dos solicitudes concurrentes del mismo tipo no permiten dos promociones vigentes al activar.
9. Destacado y Urgente pueden coexistir para el mismo aviso.
10. Un aviso eliminado o no activo bloquea activación y deriva a revisión administrativa.
11. Un pago con importe incorrecto no puede verificarse.
12. Dos pagos no pueden quedar verificados para la misma solicitud.
13. Repetir activación no duplica promociones.
14. Si falla la creación de un componente del combo, no queda activado parcialmente.
15. La expiración no modifica el aviso ni los flags administrativos.
16. Una función interna no puede ejecutarse desde roles no autorizados.
17. No hay lectura pública de notas internas, rutas de comprobantes ni datos de pago.

## 7. Decisiones aún por cerrar antes de migración

1. **Regla aprobada:** comprobante verificado, 7 días naturales desde la activación; comprobantes observados o rechazados, 7 días naturales desde la decisión administrativa correspondiente. Retención suspendida durante controversia, incidencia o revisión administrativa pendiente.
2. Definir límites definitivos de tamaño y tipos MIME aceptados para comprobantes.
3. Definir si las notas internas del administrador se separan de las notas visibles al usuario en columnas distintas o mediante una respuesta pública separada.
4. Definir mecanismo de lectura segura para el módulo del usuario y el panel comercial del administrador.

## 8. Límites

- Este documento no ejecuta SQL ni cambia Supabase.
- No crea políticas, vistas, funciones, buckets, cron jobs ni Edge Functions.
- No toca `admin.html`, `js/admin.js`, `public.avisos`, `campanas_destacado` ni bucket `media`.
