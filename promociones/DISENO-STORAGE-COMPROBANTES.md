# Diseño de Storage privado para comprobantes

## Estado
Propuesta técnica para revisión. No crea bucket ni políticas. No se ha ejecutado en Supabase.

## 1. Bucket propuesto

- ID: `comprobantes-promociones`.
- Visibilidad: **privado**.
- No reutilizar el bucket público `media`.
- No cambiar límites, MIME, policies ni triggers del bucket `media`.
- Los objetos se consultan exclusivamente por el administrador activo mediante URL firmada de duración breve. El usuario que reportó el pago no puede descargarlos ni volver a abrirlos. Nunca se genera URL pública.

Supabase Storage aplica RLS también a descargas en buckets privados. La URL firmada es un permiso temporal y no debe guardarse en tablas ni bitácora.

## 2. Ruta de objetos

Formato propuesto:

`{auth.uid()}/{solicitud_id}/{pago_uuid}.{ext}`

Ejemplo ilustrativo, no una ruta real:

`uuid-usuario/uuid-solicitud/uuid-pago.pdf`

Reglas:
- El primer segmento debe ser exactamente el UUID del usuario autenticado.
- El segundo debe corresponder a una solicitud propiedad de ese usuario.
- El nombre del archivo será un UUID generado por el servidor, no el nombre original enviado por el usuario.
- La extensión se deriva del MIME validado, no se confía en la extensión declarada.
- No incluir nombres, correos, teléfonos, CLABE, referencias bancarias ni otros datos personales en la ruta.
- No permitir sobrescritura (upsert: false); cada intento de pago crea un objeto nuevo.
- La RPC de registro valida que el objeto exista, que esté en el bucket correcto y que ruta, usuario y solicitud coincidan.

## 3. Permisos de carga

La policy de INSERT solo autorizará el bucket `comprobantes-promociones` y rutas cuyo primer segmento sea el usuario autenticado. Además, una función auxiliar de autorización en esquema no expuesto verificará:
- que la solicitud existe y pertenece al usuario;
- que está en estado `aprobada_pendiente_pago` o `pago_observado`;
- que el usuario no intenta reutilizar una ruta registrada;
- que no hay una transición concurrente que haya cerrado la posibilidad de reportar el pago.

No se conceden permisos de UPDATE ni DELETE a usuarios autenticados. La carga será de un objeto nuevo. La validación del tipo real de archivo y tamaño se realizará también en servidor; no se confiará solo en el navegador.

## 4. Permisos de lectura y descarga

- Usuario: puede consultar el estado de su pago, pero no consultar, listar ni descargar el archivo del comprobante.
- Administrador activo: puede consultar/descargar temporalmente el comprobante para revisión comercial.
- Moderador: sin acceso administrativo automático.
- Anónimo: ningún permiso.
- No se concede SELECT general que permita listar todo el bucket.
- La consola administrativa solicita una URL firmada de corta duración mediante una operación que valida que el actor sea administrador activo. No se emiten URLs al propietario. La URL no se registra en eventos ni se persiste.

Las políticas deben ser específicas por operación. Si la lectura se permite en `storage.objects`, debe restringirse al objeto concreto y a la identidad autorizada, no abrir listado de objetos del bucket.

## 5. Eliminación y retención

- Usuarios y administradores no borran objetos directamente desde el navegador.
- El borrado automático lo realiza una Edge Function dedicada en servidor mediante Storage API.
- La Edge Function comprueba el vencimiento individual, que no exista retención suspendida y que no haya controversia, incidencia o revisión administrativa pendiente.
- Comprobante verificado: eliminación elegible 7 días naturales después de la activación.
- Comprobante observado o rechazado: eliminación elegible 7 días naturales después de la decisión administrativa.
- Al liberar una retención suspendida, el archivo ya vencido vuelve a ser elegible en el siguiente ciclo.
- La eliminación del objeto no borra fila de pago, referencia, importe, actor, fechas ni eventos de auditoría.
- No ejecutar DELETE SQL directo sobre `storage.objects`.

## 6. Restricciones de carga aprobadas

El usuario aprobó expresamente los siguientes límites para cada intento de pago:
- Tamaño máximo: **5,000,000 bytes por archivo (5 MB decimales)**.
- MIME permitidos: `image/jpeg`, `image/png`, `image/webp` y `application/pdf`.
- Un solo archivo por intento de pago.
- No se permite sobrescribir un objeto existente (`upsert: false`); cada nuevo intento crea una ruta/objeto independiente.
- Rechazar SVG, HTML, ejecutables, archivos comprimidos y cualquier formato no incluido expresamente.
- Validar en servidor el MIME real, la firma del archivo y el tamaño. El nombre, extensión y MIME declarados por el navegador no son evidencia suficiente.
- No convertir automáticamente el comprobante ni alterar la evidencia original.

La interfaz debe reflejar estos límites, pero la validación de servidor y las restricciones del bucket son la autoridad. La aprobación define el diseño; todavía no configura ni crea el bucket real.

## 7. Flujo de carga y validación

La secuencia detallada de reserva de intento, carga directa al bucket, validación de firmas en Edge Function, finalización idempotente y recuperación de fallos se define en [DISENO-CARGA-VALIDACION.md](./DISENO-CARGA-VALIDACION.md). La policy de INSERT debe autorizar la ruta exacta reservada para el intento, no cualquier objeto bajo la carpeta del usuario. Un archivo no validado no debe ser visible para revisión administrativa.

## 8. Matriz de pruebas

1. Anónimo no puede cargar, listar ni descargar comprobantes.
2. Usuario A no puede cargar a una ruta de usuario B.
3. Ningún usuario puede descargar comprobantes, ni propios ni ajenos.
4. El usuario propietario solo consulta el estado de su pago; no obtiene permisos de lectura de `storage.objects`.
5. Usuario no puede cargar comprobante en solicitud rechazada, cancelada, activa o vencida.
6. Moderador no obtiene acceso administrativo.
7. Administrador activo puede descargar solo para revisión autorizada mediante URL firmada temporal.
8. No se permite sobrescribir un comprobante existente.
9. No se permite cargar un MIME no autorizado ni archivos mayores de 5,000,000 bytes; se rechaza un segundo archivo para el mismo intento.
10. No existe permiso directo de UPDATE o DELETE para el cliente.
11. La URL firmada expira y no se persiste.
12. El borrado automático usa Storage API y conserva auditoría.
13. El bucket `media` y sus políticas permanecen sin cambios.

## 9. Decisiones de privacidad aprobadas

- El comprobante es evidencia temporal para validar el pago, no un documento descargable para el usuario.
- El usuario únicamente consulta el estado de su solicitud/pago.
- Solo el administrador activo puede obtener acceso temporal al archivo para verificarlo.
- No se integrará antivirus externo en la primera versión; la validación de formato no se presentará como análisis antimalware.

## 10. Límites

- Este documento no crea bucket, policies, funciones auxiliares, Edge Functions ni secretos.
- No modifica `storage.objects`, `storage.buckets`, bucket `media`, triggers ni policies existentes.
- No toca `admin.html`, `js/admin.js`, `public.avisos` ni `campanas_destacado`.
