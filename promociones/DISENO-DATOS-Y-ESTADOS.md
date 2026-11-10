# Diseño de datos y máquina de estados del módulo de promociones

## Estado del documento
Propuesta técnica para revisión. No es una migración SQL y no debe ejecutarse directamente. Se mantiene en la rama `feature/promociones-aprobadas`.

## 1. Principios de diseño
- El módulo comercial vive en tablas y funciones propias, separadas de `public.avisos.urgente` y `public.avisos.destacado`.
- El aviso original es la referencia del producto contratado, no el contenedor de la promoción.
- Una solicitud puede contener uno o dos componentes: Destacado y/o Urgente.
- El paquete combinado se representa como dos componentes contratados dentro de una sola solicitud y un solo importe total.
- Cada componente tiene su propia vigencia y puede vencer independientemente.
- Los estados comerciales y los estados del pago son conceptos separados.
- Las acciones sensibles se validan en servidor y dejan un evento de auditoría.
- El precio, moneda, duración y nombre comercial se congelan como snapshot al crear la solicitud.

## 2. Entidades propuestas

### A. `promocion_productos`
Catálogo de productos comercializables y sus versiones.

Campos conceptuales:
- `id`: UUID, PK.
- `codigo`: texto único por versión comercial, por ejemplo `DEST-30`, `URG-7`.
- `tipo`: `destacado` o `urgente`.
- `nombre`: etiqueta visible.
- `precio_centavos`: entero positivo. Evita cálculos con decimales.
- `moneda`: `MXN`.
- `duracion_dias`: entero positivo.
- `activo`: booleano para permitir nuevas contrataciones.
- `version`: entero o identificador de versión.
- `vigente_desde`, `vigente_hasta`: vigencia comercial opcional del precio.
- `created_at`, `updated_at`.

Valores iniciales:
| Código | Tipo | Precio | Duración |
|---|---|---:|---:|
| DEST-30 | destacado | 29900 centavos | 30 días |
| URG-7 | urgente | 9900 centavos | 7 días |

El combo no necesita un producto artificial en esta tabla: se compone de ambos productos. El total de $398 MXN se calcula y se guarda como total snapshot de la solicitud. Así cada duración conserva su propia semántica.

### B. `solicitudes_promocion`
Cabecera de contratación. Una fila representa la intención comercial del usuario para un aviso.

Campos conceptuales:
- `id`: UUID, PK.
- `aviso_id`: UUID, FK a `public.avisos(id)`.
- `solicitante_id`: UUID, FK a `public.usuarios(id)`.
- `estado`: estado de revisión comercial definido abajo.
- `total_centavos`: importe total congelado.
- `moneda`: `MXN`.
- `nota_solicitante`: texto opcional.
- `nota_admin`: texto interno o de respuesta, con control de lectura.
- `created_at`, `updated_at`.
- `submitted_at`, `reviewed_at`, `reviewed_by`.

Al crearla, el servidor comprueba que `auth.uid()` es el propietario real del aviso y que el aviso sigue en estado `activo`. No se confía en un `solicitante_id` enviado libremente por el navegador.

### C. `solicitud_promocion_items`
Detalle de productos incluidos en una solicitud. Una fila por componente.

Campos conceptuales:
- `id`: UUID, PK.
- `solicitud_id`: UUID, FK a `solicitudes_promocion(id)`.
- `producto_id`: UUID, FK al catálogo, nullable solo si se decide permitir preservar productos retirados sin borrar el snapshot.
- `tipo_snapshot`: `destacado` o `urgente`.
- `nombre_snapshot`: nombre contratado.
- `precio_centavos_snapshot`: precio individual contratado.
- `moneda_snapshot`: `MXN`.
- `duracion_dias_snapshot`: duración contratada.
- `created_at`.

Restricción: no permitir dos componentes del mismo tipo dentro de una misma solicitud. El servidor deriva los importes desde el catálogo activo; nunca acepta precio o duración enviados por el cliente.

### D. `pagos_promocion`
Registro de reportes de pago. Permite más de un intento o comprobante sin sobrescribir el historial.

Campos conceptuales:
- `id`: UUID, PK.
- `solicitud_id`: UUID, FK a la solicitud.
- `reportado_por`: UUID del usuario autenticado.
- `importe_centavos_reportado`: entero positivo.
- `moneda`: `MXN`.
- `comprobante_path`: ruta interna del objeto en bucket privado; nunca URL pública.
- `estado`: `reportado`, `observado`, `verificado` o `rechazado`.
- `referencia_operacion`: texto opcional.
- `observacion_admin`: texto de respuesta.
- `reportado_at`, `revisado_at`, `revisado_por`.

Cada nuevo comprobante crea un registro. No se reemplaza el comprobante anterior ni se elimina evidencia de auditoría. La verificación compara el importe reportado contra el total aprobado y requiere acción administrativa.

### E. `promociones_activas`
Instancia de vigencia por componente. Una solicitud combinada genera dos filas.

Campos conceptuales:
- `id`: UUID, PK.
- `solicitud_item_id`: UUID, FK único al componente contratado.
- `aviso_id`: UUID, FK a `public.avisos(id)`.
- `tipo`: `destacado` o `urgente`.
- `estado`: `programada`, `activa`, `vencida` o `cancelada`.
- `activada_at`: timestamp con zona horaria.
- `vence_at`: timestamp con zona horaria.
- `activada_por`: UUID del administrador.
- `created_at`, `updated_at`.

La fecha `vence_at` se calcula en servidor a partir de `activada_at` más la duración snapshot. No se calcula desde la fecha de solicitud ni desde el reporte o verificación del pago.

### F. `eventos_promocion`
Bitácora append-only de eventos del dominio.

Campos conceptuales:
- `id`: UUID, PK.
- `solicitud_id`: UUID, FK.
- `solicitud_item_id`: UUID nullable, FK.
- `pago_id`: UUID nullable, FK.
- `promocion_id`: UUID nullable, FK.
- `actor_id`: UUID nullable para eventos del sistema.
- `actor_tipo`: `usuario`, `admin` o `sistema`.
- `evento`: código de evento controlado.
- `estado_anterior`, `estado_nuevo`: texto nullable.
- `detalle`: JSONB limitado a datos operativos no sensibles.
- `created_at`.

Los clientes no tienen permiso de UPDATE o DELETE sobre la bitácora. Las funciones de servidor agregan eventos.

## 3. Máquina de estados

### Estado de solicitud
| Estado actual | Evento autorizado | Estado siguiente | Responsable |
|---|---|---|---|
| `pendiente_revision` | Solicitud recibida | `pendiente_revision` | Usuario / sistema |
| `pendiente_revision` | Solicitar ajustes | `requiere_ajustes` | Admin |
| `requiere_ajustes` | Usuario reenvía | `pendiente_revision` | Usuario |
| `pendiente_revision` | Aprobar | `aprobada_pendiente_pago` | Admin |
| `pendiente_revision` | Rechazar | `rechazada` | Admin |
| `requiere_ajustes` | Rechazar | `rechazada` | Admin |
| `aprobada_pendiente_pago` | Usuario reporta pago | `pago_reportado` | Usuario |
| `pago_reportado` | Pago observado | `pago_observado` | Admin |
| `pago_observado` | Usuario reporta nuevo comprobante | `pago_reportado` | Usuario |
| `pago_reportado` | Verificar pago | `pago_verificado` | Admin |
| `pago_verificado` | Activar componentes, si el aviso sigue activo y supera validaciones | `activa` | Admin |
| `pago_verificado` | Aviso eliminado o no activo al intentar activar | `revision_administrativa` | Sistema / admin |
| `activa` | Vencen todos los componentes | `vencida` | Sistema |

`revision_administrativa` es un estado de excepción: bloquea la activación automática y exige una resolución explícita del administrador. No implica por sí mismo reembolso, cancelación ni pérdida del pago reportado o verificado. La decisión y su fundamento deben quedar en la bitácora.

Rechazos de pago no deben confundirse con rechazo editorial. Si un comprobante es inválido o el importe no coincide, el pago se marca observado o rechazado y la solicitud permanece sin activar, con una transición explícita que permita corregir o cerrar el caso.

### Estado de cada componente de promoción
- Antes de activarse: no existe una promoción activa; el componente está contratado y pendiente dentro de la solicitud.
- Al activar: se crea una fila `promociones_activas` con `activada_at` y `vence_at` propios.
- Al alcanzar `vence_at`: el sistema marca ese componente `vencida`.
- Una solicitud combinada pasa a `vencida` cuando ambos componentes han vencido o se han cancelado definitivamente.

El estado de la solicitud no debe impedir que el componente destacado siga activo cuando el urgente ya venció.

## 4. Reglas de negocio y validaciones
1. Solo usuarios autenticados pueden solicitar promociones.
2. El aviso debe pertenecer al usuario y estar `activo` al crear la solicitud.
3. La solicitud debe contener al menos un tipo y no repetir tipos.
4. El servidor consulta catálogo y calcula total; el cliente solo envía identificadores de producto o tipos elegidos.
5. Al aprobar, se congela el importe que debe pagarse. Cualquier cambio de precio posterior no afecta la solicitud existente.
6. Solo el propietario de la solicitud puede reportar el pago de esa solicitud.
7. Solo un admin activo, validado mediante la función de servidor existente `private.es_admin()`, puede aprobar, observar, verificar y activar.
8. Verificar el pago no activa la promoción automáticamente. Se requiere acción administrativa de activación, explícita y auditable.
9. Activar es transaccional: todas las filas de componentes que se activan en esa acción deben crearse correctamente o no crearse ninguna.
10. Una operación repetida no puede duplicar solicitudes, pagos verificados ni promociones activas. Usar restricciones únicas e idempotencia en las funciones RPC.
11. La expiración de una promoción no modifica `public.avisos.status`, sus métricas ni los campos `urgente` y `destacado`.
12. Si el aviso se elimina o deja de estar activo antes de la activación, la activación se bloquea. Si ya existe un pago reportado o verificado, la solicitud pasa a `revision_administrativa`, conserva todos sus registros y comprobantes, y requiere resolución expresa del administrador. No se ejecuta reembolso, cancelación ni eliminación de evidencia de forma automática.
13. No permitir solicitar otra promoción del mismo tipo para el mismo aviso mientras exista una promoción vigente de ese tipo. Se permite una nueva solicitud cuando la anterior haya vencido o haya sido cancelada definitivamente. La validación se ejecuta en servidor dentro de la transacción de solicitud y vuelve a comprobarse al activar.
14. Destacado y Urgente pueden coexistir en el mismo aviso, porque son componentes distintos con vigencias independientes.
15. Toda transición debe insertar evento en bitácora dentro de la misma transacción.

## 5. Acceso y RLS propuestos
- `promocion_productos`: lectura de productos activos para usuarios; escritura solo por administrador mediante función protegida.
- `solicitudes_promocion`: SELECT del propietario y admin; INSERT mediante RPC autenticada; UPDATE directo bloqueado para clientes.
- `solicitud_promocion_items`: SELECT a través de la solicitud propietaria o admin; INSERT solo dentro de RPC de creación; UPDATE/DELETE bloqueados.
- `pagos_promocion`: SELECT del propietario y admin; INSERT de reporte mediante RPC y validación de propiedad; verificación solo admin.
- `promociones_activas`: lectura pública solo de datos de presentación mínimos para avisos activos; lectura detallada del propietario/admin; escritura solo por RPC admin o proceso de sistema.
- `eventos_promocion`: lectura filtrada para propietario/admin según tipo de evento; INSERT solo servidor; UPDATE/DELETE prohibidos para clientes.

Las políticas deben diseñarse evitando policies PERMISSIVE superpuestas que amplíen acceso por OR. La lectura pública no debe exponer datos personales, notas internas, importes de comprobantes ni rutas privadas.

## 6. Almacenamiento de comprobantes
- Crear bucket privado separado de `media`.
- Rutas bajo carpeta por usuario y solicitud, con UUIDs no controlados libremente por el cliente.
- Validar propietario y solicitud en políticas de Storage y en RPC.
- Lectura únicamente por propietario de la solicitud y admin activo.
- Límites de tamaño y MIME explícitos; rechazar SVG y formatos ejecutables.
- El archivo binario del comprobante se conserva durante 7 días naturales contados desde la activación de la promoción (momento en que el administrador activa los componentes después de verificar el pago). El plazo no comienza al cargar el archivo, reportar el pago ni verificarlo si la promoción aún no se ha activado.
- Al cumplirse los 7 días, el sistema elimina el archivo del bucket privado mediante Storage API. No se debe intentar borrarlo con DELETE directo sobre `storage.objects`, porque existe protección de borrado.
- Si hay una incidencia, controversia, revisión administrativa o investigación pendiente, se suspende la eliminación del archivo hasta que el caso quede resuelto. La suspensión y la resolución deben quedar registradas en la bitácora.
- La eliminación del archivo no elimina el registro del pago ni los metadatos de auditoría: importe, moneda, referencia de operación, fecha de reporte, quién verificó el pago, cuándo se verificó y cuándo se activó la promoción permanecen conservados.
- No alterar bucket `media`, sus policies ni su trigger de cuota.

## 7. RPCs previstas
- `solicitar_promocion(aviso_id, productos[])`: valida sesión, propiedad, estado del aviso, catálogo, duplicados y calcula total; crea cabecera, items y evento.
- `revisar_solicitud_promocion(solicitud_id, decision, nota)`: solo admin; permite aprobar, pedir ajustes o rechazar.
- `reportar_pago_promocion(solicitud_id, importe, comprobante_path, referencia)`: valida propietario y estado; registra intento y evento.
- `revisar_pago_promocion(pago_id, decision, nota)`: solo admin; observa, rechaza o verifica importe y evidencia.
- `activar_promocion(solicitud_id)`: solo admin; exige pago verificado, aviso activo, ausencia de traslape y crea componentes con sus fechas de vigencia. Si el aviso ya no está activo, no crea promociones y deriva la solicitud a `revision_administrativa`.
- `vencer_promociones()`: función de sistema idempotente que marca vencidos los componentes cuyo `vence_at` ya pasó y cierra la solicitud cuando todos sus componentes terminaron.

Todas las funciones SECURITY DEFINER deberán fijar `search_path`, cualificar nombres de objetos, revocar EXECUTE de `PUBLIC` y otorgar permisos solo a roles necesarios. La función admin reutiliza `private.es_admin()` como validación del rol administrativo real.

## 8. Preguntas que bloquean la migración
1. **Regla aprobada:** no se permite solicitar otra promoción del mismo tipo para el mismo aviso mientras exista una promoción vigente. Se permitirá una nueva solicitud cuando la anterior haya vencido o haya sido cancelada definitivamente. La validación debe ejecutarse en servidor dentro de la transacción de solicitud y volver a comprobarse al activar, para evitar solicitudes simultáneas o carreras.
2. **Regla aprobada:** si un aviso se elimina o deja de estar activo después de reportar el pago y antes de activar la promoción, se bloquea la activación y el caso pasa a revisión administrativa. Se conservan solicitud, pagos, comprobantes e historial. No se presume reembolso ni cancelación; el administrador debe resolver el caso y registrar su decisión.
3. **Regla aprobada:** conservar el archivo binario del comprobante durante 7 días naturales desde la activación de la promoción y eliminarlo automáticamente al vencer el plazo. Si existe una incidencia o controversia pendiente, suspender el borrado hasta su resolución. Conservar permanentemente los metadatos de auditoría, aunque el archivo se haya eliminado. Antes de habilitar cargas reales, definir e implementar el proceso automatizado de borrado mediante Storage API y las excepciones por retención.
4. ¿Se permitirá al usuario cancelar una solicitud antes de la aprobación? Recomendación: sí, mientras esté pendiente de revisión o ajustes.

## 9. Fuera de alcance
- No se ha creado ni ejecutado SQL.
- No se han creado tablas, funciones, políticas, buckets ni cron jobs.
- No se ha modificado `admin.html`, `js/admin.js`, la portada ni los flags actuales.
- No se ha reutilizado ni alterado `campanas_destacado`.
- No se ha conectado una pasarela de pago.

## 10. Diseño operativo del borrado automático de comprobantes

### Arquitectura elegida para implementar después de aprobar el esquema

Se propone un proceso diario con **Supabase Cron + pg_net + Edge Function dedicada**, porque la eliminación del archivo debe pasar por la Storage API y no por SQL directo sobre `storage.objects`.

Flujo previsto:

1. `pg_cron` ejecuta una tarea diaria.
2. La tarea invoca por HTTPS una Edge Function exclusiva para retención de comprobantes, mediante `pg_net`.
3. La función valida un secreto de ejecución dedicado y utiliza credenciales privilegiadas guardadas únicamente como secretos del entorno de Edge Functions.
4. La función obtiene un lote pequeño de comprobantes cuyo plazo de retención ya venció y que no tengan una retención legal/administrativa activa.
5. Antes de borrar, vuelve a comprobar que el caso no esté en revisión administrativa ni tenga una incidencia abierta.
6. El archivo se elimina usando `supabase.storage.from(bucket).remove([path])`.
7. Solo después de confirmar la eliminación, se marca el comprobante como eliminado y se agrega un evento de auditoría.
8. Si falla Storage o la actualización de metadatos, el registro no se marca como eliminado. El siguiente ciclo reintenta de forma idempotente y deja constancia del error.

### Datos de control necesarios

La implementación deberá incorporar, como mínimo, campos o una entidad equivalente para:

- Fecha límite de eliminación: calculada como activación + 7 días naturales.
- Fecha efectiva de eliminación del archivo.
- Indicador de retención suspendida y motivo.
- Actor y fecha de liberación de una retención.
- Estado del último intento y detalle técnico saneado del error, sin guardar secretos.
- Identificador/ruta interna del objeto, nunca una URL pública.

La suspensión de retención debe ser explícita, auditable y reversible únicamente por un administrador autorizado. Además de revisar el indicador, el proceso debe comprobar el estado de la solicitud para no borrar comprobantes vinculados a `revision_administrativa`.

### Seguridad del ejecutor

- La Edge Function no acepta rutas ni IDs arbitrarios enviados por el solicitante HTTP.
- El endpoint solo procesa lotes seleccionados desde la base de datos.
- El secreto que autoriza la invocación se guarda en Supabase Vault y en los secretos de la función; nunca en el repositorio ni en el navegador.
- La credencial privilegiada para Storage permanece exclusivamente en el entorno servidor.
- No se devuelve al invocador información personal, rutas completas ni datos bancarios.
- La función debe limitar el tamaño del lote, registrar conteos y resultados por lote, y evitar ejecuciones concurrentes sobre el mismo comprobante.
- La función no modifica `avisos`, `admin.html`, `js/admin.js`, los flags administrativos ni el bucket `media`.

### Frecuencia y tolerancia operativa

La tarea correrá una vez al día. El archivo será elegible al cumplirse las 168 horas desde la activación y se eliminará en el siguiente ciclo exitoso. Por la frecuencia diaria, la eliminación efectiva podrá ocurrir dentro de las 24 horas posteriores al vencimiento del plazo. Si se requiere una ventana más estricta, deberá aumentarse la frecuencia del cron.

### Pruebas de aceptación antes de producción

1. Un comprobante con menos de 7 días desde la activación no se elimina.
2. Un comprobante que ya cumplió 7 días y no tiene retención se elimina mediante Storage API.
3. Un comprobante con retención suspendida permanece en Storage aunque haya vencido su plazo.
4. Un comprobante ligado a una solicitud en `revision_administrativa` no se elimina.
5. Al liberar una retención, el comprobante vencido vuelve a ser elegible en el siguiente ciclo.
6. Un error de Storage no marca el archivo como eliminado y permite reintento.
7. Repetir el proceso no duplica eventos ni altera registros ya procesados.
8. La eliminación del archivo no borra el registro de pago ni sus metadatos de auditoría.
9. Una invocación sin el secreto correcto es rechazada.
10. No hay escrituras en `avisos`, `campanas_destacado` ni en el bucket `media`.

### Condición de activación

Este diseño no crea ni habilita todavía extensiones, cron jobs, secretos, Edge Functions, buckets o políticas. Primero deben existir y aprobarse el esquema definitivo de promociones, el bucket privado y las reglas de retención. Después se implementará en una rama/entorno de prueba, se ejecutarán las pruebas anteriores y se solicitará autorización específica antes de desplegar o activar el cron en producción.
