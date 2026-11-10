# Implementación propuesta: comprobantes y revisión de pagos

## Estado

Se agregó una primera implementación documental en la rama `feature/promociones-aprobadas`:

- SQL: `promociones/sql/003_comprobantes_y_revision_pagos.sql`
- Edge Function: `supabase/functions/comprobantes-promocion/index.ts`
- Configuración local de Supabase: `supabase/config.toml`

**Nada de esto se ha desplegado ni ejecutado en el proyecto Supabase.** El archivo SQL requiere pruebas PostgreSQL aisladas y revisión de permisos antes de aplicarse. La Edge Function requiere revisión, pruebas y despliegue independiente.

## Flujo del comprobante

1. El usuario autenticado solicita una reserva con `reservar_comprobante_promocion`.
2. El servidor comprueba propiedad, estado comercial, aviso activo, importe exacto y MIME declarado permitido.
3. El servidor genera el UUID y la ruta interna. La reserva vence en 30 minutos.
4. El navegador carga un único objeto nuevo al bucket privado con `upsert: false`.
5. El navegador invoca la Edge Function `comprobantes-promocion` con `accion: "validar"` y `pago_id`.
6. La Edge Function vuelve a autenticar al usuario, reclama la validación y descarga el objeto mediante Storage API con credenciales servidor.
7. La función comprueba tamaño, firma binaria y coincidencia MIME, y calcula SHA-256.
8. Solo el rol `service_role` puede finalizar la validación mediante la RPC restringida.
9. Un archivo válido cambia el intento a `estado_carga=validado` y `estado_pago=reportado`; la solicitud pasa a `pago_reportado`.
10. Un archivo inválido se elimina mediante Storage API, queda como `invalido` y no se presenta al administrador.
11. Los fallos transitorios quedan como `error` y permiten reintento mientras la reserva no haya vencido.

La validación de firma y MIME no es análisis antivirus. No se declara protección antimalware.

## Revisión administrativa

La RPC `revisar_pago_promocion` requiere administrador activo:

- `verificar`: cambia el pago a `verificado` y la solicitud a `pago_verificado`. La fecha de eliminación queda pendiente hasta que se active la promoción; la RPC de activación ya fija activación + 7 días.
- `observar`: conserva el comprobante durante 7 días desde la decisión, cambia la solicitud a `pago_observado` y permite un nuevo intento.
- `rechazar`: conserva el comprobante durante 7 días desde la decisión, devuelve la solicitud a `aprobada_pendiente_pago` y permite un nuevo intento. El rechazo del comprobante no rechaza la contratación.

La función `obtener_ruta_comprobante_admin` solo devuelve la ruta a un administrador activo. La Edge Function usa esa ruta para crear una URL firmada de descarga de 90 segundos. La URL no se almacena ni se registra en logs.

El usuario propietario no obtiene URL ni permiso de lectura. Solo consulta estados mediante las futuras RPC de consulta.

## Bucket requerido

Crear manualmente en Supabase Dashboard, antes de aplicar la policy:

| Ajuste | Valor |
|---|---|
| Bucket ID | `comprobantes-promociones` |
| Público | No, privado |
| Límite por archivo | 5,000,000 bytes |
| MIME | `image/jpeg`, `image/png`, `image/webp`, `application/pdf` |

No cambiar el bucket `media`, sus límites, políticas o triggers. Confirmar primero que el límite global de Storage admite 5,000,000 bytes.

La policy propuesta solo concede INSERT sobre una ruta exacta previamente reservada. No crea SELECT, UPDATE ni DELETE para usuarios. La policy de inserción existente de `media` no debe ampliarse. Antes de aplicar, volver a revisar todas las policies actuales de `storage.objects`, ya que las policies PERMISSIVE se combinan mediante OR.

## Edge Function

Ruta: `supabase/functions/comprobantes-promocion/index.ts`

Acciones POST:

### Validar archivo

```json
{
  "accion": "validar",
  "pago_id": "UUID-del-intento"
}
```

Requiere JWT de usuario autenticado y propiedad del intento.

### Emitir URL temporal para administrador

```json
{
  "accion": "url_admin",
  "pago_id": "UUID-del-intento"
}
```

Requiere JWT de administrador activo. Devuelve URL firmada con vigencia de 90 segundos.

### Variables de entorno

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PROMOCIONES_ALLOWED_ORIGINS`: lista separada por comas de orígenes web autorizados. El valor predeterminado en el código es `https://elbarrio.me`; ajustar solo después de confirmar los dominios reales de producción y pruebas.

La service role key existe solo en el entorno servidor. Nunca debe incorporarse a HTML, JavaScript del navegador, repositorio, respuestas HTTP ni logs.

La configuración del proyecto marca `verify_jwt = true` para esta función. La función también verifica el usuario y vuelve a validar autorización en cada RPC.

## Política de estados y recuperación

- Una reserva pendiente dura 30 minutos.
- Una validación en curso no se puede reclamar simultáneamente. Si queda abandonada más de 5 minutos, se vuelve reintentable si la reserva sigue vigente; de lo contrario expira.
- Un nuevo intento crea UUID y ruta nuevos; no sobrescribe objetos.
- Los comprobantes observados/rechazados tienen retención de 7 días desde la decisión.
- Los comprobantes verificados esperan a la activación para iniciar la retención de 7 días.
- Una controversia o revisión administrativa suspende la eliminación; la RPC para suspender/liberar retención y el proceso diario de limpieza siguen pendientes.
- El borrado físico siempre se hará mediante Storage API, nunca con DELETE SQL sobre `storage.objects`.

## Pruebas obligatorias antes de desplegar

1. Usuario A no reserva, carga, valida ni consulta intentos de usuario B.
2. Un usuario no puede cargar una ruta no reservada o de otro usuario.
3. Una reserva caducada no admite carga ni validación.
4. Dos llamadas simultáneas no validan dos veces el mismo intento.
5. Reintento tras error temporal no duplica pagos ni eventos de aceptación.
6. JPEG, PNG, WebP y PDF válidos se aceptan solo si firma y MIME declarado coinciden.
7. SVG, HTML, ejecutables, ZIP, PDF/imagen falsificados y archivos vacíos se rechazan.
8. Archivos mayores de 5,000,000 bytes se rechazan.
9. Un usuario no obtiene URL firmada, aunque conozca un UUID de pago.
10. Moderador no obtiene URL firmada ni puede revisar pagos.
11. Solo administrador activo puede revisar y obtener URL firmada.
12. URL firmada expira y nunca se persiste.
13. Observar/rechazar establece retención de siete días y permite nuevo intento.
14. Verificar exige importe exacto y permite activar únicamente por RPC administrativa.
15. Fallo de Storage API no expone el archivo; el borrado pendiente debe quedar disponible para limpieza diaria.
16. Las policies combinadas no abren lectura, actualización o borrado del bucket.
17. Bucket `media`, `public.avisos`, flags, triggers, `campanas_destacado`, `admin.html` y `js/admin.js` permanecen intactos.

## Pendientes de la siguiente etapa

- RPC de consulta de estado para el propietario sin exponer ruta o metadatos sensibles.
- Las RPC para suspender/liberar retención y reclamar/registrar borrados ya están propuestas en `sql/004_retencion_y_limpieza.sql`.
- La Edge Function de limpieza diaria está propuesta en `supabase/functions/limpiar-comprobantes-promocion/index.ts`.
- Pendiente: crear secreto en Edge Functions y Vault, habilitar Cron/pg_net y programar la ejecución diaria conforme a `ESTADO-RETENCION-Y-LIMPIEZA.md`.
- Pruebas PostgreSQL, Storage y Edge Function en un entorno aislado.
- Confirmación visual del límite global de Storage y de la configuración Data API.
- Revisión de permisos efectivos y Supabase Advisors.

## Zona protegida

No modificar:

- `admin.html`
- `js/admin.js`
- Checks administrativos Urgente y Destacado
- `public.avisos` y sus triggers
- `campanas_destacado`
- Bucket `media`

El módulo de promociones mantiene sus propias tablas, políticas, funciones y Edge Function.
