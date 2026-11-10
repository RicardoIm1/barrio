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
| `pago_verificado` | Activar componentes | `activa` | Admin |
| `activa` | Vencen todos los componentes | `vencida` | Sistema |

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
12. Si el aviso se elimina o deja de estar activo antes de la activación, la activación debe bloquearse y requerir revisión administrativa.
13. No permitir activar dos promociones vigentes del mismo tipo para el mismo aviso sin una política de traslapes aprobada.
14. Toda transición debe insertar evento en bitácora dentro de la misma transacción.

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
- Eliminar o retener comprobantes según una política de conservación aprobada; no borrar evidencia de forma automática sin definirla.
- No alterar bucket `media`, sus policies ni su trigger de cuota.

## 7. RPCs previstas
- `solicitar_promocion(aviso_id, productos[])`: valida sesión, propiedad, estado del aviso, catálogo, duplicados y calcula total; crea cabecera, items y evento.
- `revisar_solicitud_promocion(solicitud_id, decision, nota)`: solo admin; permite aprobar, pedir ajustes o rechazar.
- `reportar_pago_promocion(solicitud_id, importe, comprobante_path, referencia)`: valida propietario y estado; registra intento y evento.
- `revisar_pago_promocion(pago_id, decision, nota)`: solo admin; observa, rechaza o verifica importe y evidencia.
- `activar_promocion(solicitud_id)`: solo admin; exige pago verificado, aviso activo, ausencia de traslape y crea componentes con sus fechas de vigencia.
- `vencer_promociones()`: función de sistema idempotente que marca vencidos los componentes cuyo `vence_at` ya pasó y cierra la solicitud cuando todos sus componentes terminaron.

Todas las funciones SECURITY DEFINER deberán fijar `search_path`, cualificar nombres de objetos, revocar EXECUTE de `PUBLIC` y otorgar permisos solo a roles necesarios. La función admin reutiliza `private.es_admin()` como validación del rol administrativo real.

## 8. Preguntas que bloquean la migración
1. ¿Se permitirá solicitar otra promoción del mismo tipo mientras una anterior sigue activa? Recomendación: no; permitir una nueva solicitud cuando haya vencido la vigente.
2. ¿Qué política se aplicará si un aviso se elimina mientras una solicitud está en revisión o después de pagar? Recomendación: bloquear activación, revisión manual y no perder el historial.
3. ¿Cuánto tiempo se conservarán los comprobantes y quién puede eliminarlos? Debe decidirse antes de habilitar cargas reales.
4. ¿Se permitirá al usuario cancelar una solicitud antes de la aprobación? Recomendación: sí, mientras esté pendiente de revisión o ajustes.

## 9. Fuera de alcance
- No se ha creado ni ejecutado SQL.
- No se han creado tablas, funciones, políticas, buckets ni cron jobs.
- No se ha modificado `admin.html`, `js/admin.js`, la portada ni los flags actuales.
- No se ha reutilizado ni alterado `campanas_destacado`.
- No se ha conectado una pasarela de pago.