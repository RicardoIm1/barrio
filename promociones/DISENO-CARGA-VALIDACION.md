# Diseño de carga y validación de comprobantes

## Estado
Diseño técnico para revisión. No crea funciones, políticas, tablas, buckets ni secretos. No se ha ejecutado en Supabase.

## 1. Objetivo y principio de seguridad

Separar tres hechos que no deben confundirse:

1. El usuario seleccionó un archivo.
2. El archivo llegó al Storage privado.
3. El servidor validó el contenido y aceptó el archivo como comprobante reportado.

La carga por sí sola no convierte el archivo en evidencia aceptada ni permite que administración lo revise. El comprobante solo pasa a estado reportado después de superar la validación del servidor.

## 2. Límites aprobados

- Máximo: **5,000,000 bytes por archivo** (5 MB decimales).
- MIME permitidos: `image/jpeg`, `image/png`, `image/webp` y `application/pdf`.
- Un archivo por intento de pago.
- Sin sobrescritura: `upsert: false`.
- No se admiten SVG, HTML, archivos ejecutables, comprimidos ni formatos distintos de los cuatro autorizados.
- No se transforma ni comprime el comprobante original.

El límite de 5,000,000 bytes será la referencia única de servidor, cliente y bucket para evitar diferencias de interpretación entre MB y MiB.

## 3. Arquitectura propuesta

Se recomienda carga directa del navegador a Supabase Storage privado, seguida de validación en una Edge Function. Para archivos de hasta 5 MB esto evita transportar el binario dos veces por una función intermediaria, pero mantiene la aceptación bajo control del servidor.

Componentes:
- RPC de inicio de carga: reserva un intento de pago y genera un identificador/ruta impredecible.
- Bucket privado `comprobantes-promociones`: recibe el objeto nuevo.
- Policy de Storage INSERT: autoriza exclusivamente la ruta reservada para el usuario y el intento concreto.
- Edge Function de validación: descarga el objeto desde Storage, inspecciona contenido real y confirma o invalida la carga.
- RPC/operación interna de finalización: registra metadatos validados y cambia el estado de carga de forma idempotente.
- Operación administrativa de consulta/URL firmada: autoriza al administrador activo a visualizar o descargar temporalmente el comprobante para validar el pago. El usuario no recibe URL ni permiso de descarga.

No se expondrá `service_role` ni una clave secreta en HTML, JavaScript, repositorio o navegador.

## 4. Secuencia completa

### Paso A. Reservar intento

1. El usuario autenticado selecciona un archivo y un importe.
2. El navegador valida preliminarmente tamaño, extensión y MIME para dar retroalimentación rápida. Esta comprobación no es de seguridad.
3. El navegador llama a una RPC autenticada, sin enviar un `solicitante_id` ni una ruta elegida libremente.
4. La RPC comprueba:
   - `auth.uid()` corresponde al propietario de la solicitud.
   - La solicitud está en `aprobada_pendiente_pago` o `pago_observado`.
   - El importe reportado corresponde al total aprobado, sujeto a la validación administrativa definida en el diseño de pagos.
   - No existe otro intento de carga abierto para la misma operación.
5. La RPC crea una fila de intento con estado de carga `pendiente_carga`, genera UUID y ruta, y registra el evento.
6. Devuelve solo el identificador del intento y la ruta exacta autorizada para cargar.

La fila de pago y el estado de carga deben distinguirse: `estado_pago` (reportado/observado/verificado/rechazado) y `estado_carga` (pendiente_carga/validando/validado/invalido/error). Los nombres finales se fijarán en el esquema SQL revisado.

### Paso B. Subir el archivo

1. El navegador carga el archivo directamente al bucket privado.
2. La ruta se deriva del usuario, solicitud e intento reservado; el nombre original no se utiliza.
3. La carga se ejecuta con `upsert: false`.
4. La policy de INSERT permite únicamente el objeto reservado, cuando la fila correspondiente sigue en `pendiente_carga` y pertenece a `auth.uid()`.
5. La configuración del bucket rechaza archivos mayores a 5,000,000 bytes y MIME declarado fuera de la lista permitida.

La policy no debe aceptar cualquier ruta que simplemente comience con el UUID del usuario. Debe comprobar la correspondencia exacta con el intento reservado y el estado que habilita la carga.

### Paso C. Validar en servidor

Después de cargar, el navegador invoca la Edge Function de validación con el identificador del intento. La función:

1. Verifica el JWT del usuario y obtiene la identidad autenticada. No confía en un ID de usuario enviado en el cuerpo.
2. Comprueba que el intento pertenece a ese usuario, sigue pendiente y no fue finalizado antes.
3. Recupera de la base de datos la ruta reservada; no acepta una ruta arbitraria del cliente.
4. Descarga el objeto desde el bucket privado usando credenciales exclusivas del entorno servidor.
5. Comprueba el tamaño real en bytes y rechaza más de 5,000,000.
6. Detecta el tipo por la firma binaria (magic bytes), no por nombre, extensión o encabezado MIME del navegador:
   - JPEG: firma JPEG reconocible.
   - PNG: firma PNG.
   - WebP: contenedor RIFF con identificador WEBP.
   - PDF: encabezado PDF y estructura mínima coherente.
7. Comprueba que el tipo detectado corresponde a uno de los cuatro tipos aprobados y que no contradice el tipo declarado.
8. Rechaza contenido vacío, truncado, de tipo mixto evidente o con discrepancia de formato.
9. Si es válido, registra MIME detectado, tamaño, hash SHA-256, fecha de validación y ruta interna; cambia el estado de carga a `validado` y el pago a `reportado`, dentro de una operación idempotente.
10. Si no es válido, marca el intento `invalido`, registra un motivo técnico saneado y elimina el objeto mediante Storage API. No marca el pago como reportado.

La detección de firmas identifica formatos, pero no equivale a un antivirus ni garantiza que un documento esté libre de contenido malicioso. No se debe afirmar que hay análisis antimalware hasta integrar y probar un servicio específico.

### Paso D. Disponibilidad para revisión

- Un archivo `pendiente_carga`, `validando`, `invalido` o `error` no se muestra en la consola administrativa como comprobante revisable.
- Solo un intento `validado` puede aparecer para revisión del administrador.
- La revisión administrativa conserva el flujo ya diseñado: observar, rechazar o verificar.
- Un nuevo comprobante después de una observación crea otro intento y otro objeto; nunca reemplaza el anterior.

## 5. Estados y recuperación de fallos

| Situación | Estado de carga | Tratamiento |
|---|---|---|
| RPC reservó ruta, archivo aún no subido | `pendiente_carga` | Permitir completar carga mientras la reserva siga vigente |
| Objeto cargado, validación iniciada | `validando` | No visible para revisión |
| Archivo válido | `validado` | Habilitar revisión de pago |
| Firma, tamaño o formato inválido | `invalido` | Borrar objeto por Storage API y conservar metadatos |
| Error temporal de Edge Function/Storage | `error` o pendiente recuperable | Permitir reintento idempotente; no crear otro pago automáticamente |
| Reserva abandonada | pendiente vencido | Proceso de limpieza elimina objeto huérfano si existe y cierra la reserva |

La duración exacta de una reserva pendiente y la frecuencia de limpieza quedan por definir antes de implementar. El proceso de limpieza nunca debe borrar un archivo validado ni un comprobante sujeto a retención administrativa.

## 6. Acceso y privacidad

- Anónimo: sin carga, listado ni descarga.
- Usuario: puede iniciar la carga y consultar únicamente el estado de sus propios intentos y pagos. No puede descargar ni volver a abrir el comprobante después de enviarlo.
- Administrador activo: puede visualizar o descargar temporalmente el comprobante para revisión comercial, previa validación de rol en servidor.
- Moderador: no recibe acceso administrativo automáticamente.
- No se permite SELECT general para listar todo el bucket.
- No se conceden UPDATE ni DELETE directos a clientes.
- La lectura administrativa se entrega mediante URL firmada de vida corta, emitida tras comprobar autorización. La URL no se guarda en tablas, logs ni bitácora.
- No se genera URL firmada ni permiso de lectura para el usuario propietario. Su pantalla muestra estado del pago y, cuando corresponda, el resultado de la revisión.
- La interfaz administrativa debe evitar incrustar el archivo como contenido activo; preferir descarga controlada. Las URLs firmadas no deben compartirse ni persistirse.

Las políticas de Storage se diseñarán por operación y con autorización sobre el intento exacto. Se revisarán junto con las policies existentes para evitar que una policy PERMISSIVE adicional abra acceso por combinación OR.

## 7. Metadatos y auditoría

Conservar en base de datos, incluso después de borrar el binario:
- ID de intento y relación con solicitud.
- Usuario que reportó.
- Importe y moneda reportados.
- Referencia de operación, si existe.
- Ruta interna del objeto, sin URL pública.
- MIME declarado y MIME detectado.
- Tamaño en bytes.
- Hash SHA-256.
- Fecha de carga y validación.
- Estado y resultado de validación.
- Actor y fecha de revisión administrativa.
- Fechas de activación y retención/borrado del archivo.
- Eventos de transición.

No registrar el contenido del comprobante, URLs firmadas, tokens, claves ni datos bancarios completos en logs.

## 8. Pruebas de aceptación

1. Usuario no autenticado no puede reservar ni cargar.
2. Usuario A no puede reservar, cargar ni validar para usuario B; tampoco puede descargar comprobantes propios o ajenos.
3. Cambiar el UUID de ruta no permite escribir en otro intento.
4. La carga rechaza un objeto de más de 5,000,000 bytes.
5. Se rechaza MIME no incluido aunque el usuario cambie la extensión.
6. Se rechaza un archivo ejecutable renombrado como PDF o imagen.
7. Se rechaza un PDF/imagen cuyo contenido no coincide con el tipo declarado.
8. No se puede cargar un segundo objeto al mismo intento ni sobrescribir el primero.
9. Un intento no validado no aparece en la consola de revisión.
10. Repetir la llamada de validación no duplica pagos, hashes ni eventos de aceptación.
11. Un error temporal permite reintentar sin crear pagos duplicados.
12. El usuario no puede invocar la validación con ID de intento ajeno.
13. Moderador no obtiene acceso administrativo.
14. Solo el administrador activo puede obtener una URL firmada temporal; el usuario propietario no puede descargar el comprobante.
15. El borrado de inválidos/huérfanos usa Storage API.
16. La retención aprobada de siete días y sus excepciones siguen vigentes.
17. El bucket `media`, sus cuotas, policies y triggers permanecen intactos.
18. No se modifican `admin.html`, `js/admin.js`, `public.avisos` ni `campanas_destacado`.

## 9. Decisiones pendientes antes de implementar

- Definir el tiempo de vigencia de una reserva de carga incompleta y la frecuencia del proceso de limpieza.
- Decisión aprobada: el usuario únicamente consulta el estado de su pago; no descarga ni vuelve a abrir el comprobante. El administrador activo conserva acceso temporal para verificarlo.
- Decisión de alcance: no integrar un servicio antimalware externo en esta primera versión para reducir costos y dependencias. La validación de tamaño, MIME y firma binaria es una comprobación de formato, no un análisis antivirus ni una garantía de ausencia de malware.
- Revisar el límite global de Storage del proyecto: el bucket puede fijar 5 MB, pero no superar el límite global configurado.
- Confirmar los grants de Data API y RLS para las tablas nuevas; no asumir que crear una tabla en `public` la expone automáticamente.

## 10. Límites de este documento

- No crea ni modifica objetos de Supabase.
- No crea Edge Functions, RPCs, policies, buckets, secretos ni cron jobs.
- No altera la tabla `public.avisos`, los flags administrativos ni el bucket `media`.
- No toca `admin.html` ni `js/admin.js`.
- Es un diseño para revisión antes de escribir migraciones y código.
