# Retención y limpieza automatizada de comprobantes

## Estado

Propuesta documental en la rama `feature/promociones-aprobadas`:

- SQL: `promociones/sql/004_retencion_y_limpieza.sql`
- Edge Function: `supabase/functions/limpiar-comprobantes-promocion/index.ts`
- Configuración: `supabase/config.toml`

No se ha ejecutado SQL, creado secretos, desplegado funciones ni programado Cron en el proyecto.

## Reglas de retención

| Tipo de comprobante | Elegible para eliminación |
|---|---|
| Archivo inválido | Después de registrar el rechazo técnico y solicitar su borrado por Storage API |
| Reserva sin completar | Después de vencer a los 30 minutos; limpieza física en ciclo diario |
| Pago observado | 7 días naturales después de la decisión |
| Pago rechazado | 7 días naturales después de la decisión |
| Pago verificado | 7 días naturales después de activar la promoción |
| Controversia/incidencia/revisión pendiente | No se elimina mientras la retención esté suspendida |

La fila de pago, importe, moneda, referencia, hash, fechas, actor y bitácora se conservan. La limpieza solo elimina el objeto binario mediante Storage API.

## RPC de retención y limpieza

- `suspender_retencion_comprobante`: administrador activo, motivo obligatorio, bitácora.
- `liberar_retencion_comprobante`: administrador activo, motivo obligatorio, bitácora; si la fecha de retención ya venció, queda elegible para el siguiente ciclo.
- `reclamar_comprobantes_para_limpieza`: solo `service_role`; reclama lotes con `FOR UPDATE SKIP LOCKED`, hasta 200 filas por llamada.
- `registrar_borrado_comprobante`: solo `service_role`; registra resultado de Storage API e historial.

El borrado fallido queda registrado con código técnico saneado y puede reintentarse en el siguiente ciclo. No se registra la ruta ni el error completo en la bitácora.

La suspensión de retención se bloquea durante los 15 minutos posteriores a la reclamación de limpieza para evitar una carrera mientras Storage API está eliminando el objeto. Cada ejecución de Edge Function se limita a 100 objetos.

## Edge Function

Ruta: `supabase/functions/limpiar-comprobantes-promocion/index.ts`.

- Método: POST.
- `verify_jwt = false`, porque Cron no usa sesión de usuario.
- Autenticación obligatoria mediante cabecera `x-cleanup-secret`.
- El secreto se compara en el servidor y nunca se devuelve.
- La función usa service role solo en servidor.
- Procesa lotes de hasta 20 objetos, con máximo de 5 lotes por ejecución.
- Elimina mediante `storage.from('comprobantes-promociones').remove([...])`.
- Registra el resultado mediante RPC exclusiva de service role.

## Configuración de secretos

Configurar dos valores con el mismo secreto aleatorio de alta entropía:

1. Edge Function secret: `PROMOCIONES_CLEANUP_SECRET`.
2. Supabase Vault secret: nombre `promociones_cleanup_secret`.

Además, la Edge Function requiere `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en su entorno. La service role key nunca se coloca en el SQL del Cron, en el navegador ni en el repositorio.

No reutilizar contraseñas, tokens de usuario ni VAPID keys.

## Programación diaria propuesta

Una vez desplegada y probada la función, habilitar extensiones Cron, pg_net y Vault según la disponibilidad del proyecto. Guardar el secreto en Vault y programar la invocación desde Cron.

Ejemplo de referencia, no ejecutar antes de desplegar la Edge Function y crear el secreto:

```sql
select cron.schedule(
  'limpiar-comprobantes-promocion',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://gnjaumpjerbbwlkcgxqa.supabase.co/functions/v1/limpiar-comprobantes-promocion',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cleanup-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'promociones_cleanup_secret'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
```

El horario de ejemplo es 09:00 UTC (03:00 en Puerto Vallarta). Confirmar extensiones, permisos y comportamiento de Cron/pg_net en una base aislada antes de programarlo. Registrar el job y definir un procedimiento de pausa/reanudación.

## Pruebas obligatorias

1. Sin secreto, secreto incorrecto o método distinto de POST: rechazar.
2. Ningún usuario autenticado puede invocar las RPC internas de limpieza.
3. Una reserva no vencida nunca se reclama.
4. Una reserva vencida sí se reclama y el objeto se elimina por Storage API.
5. Un comprobante inválido se elimina y conserva su fila de auditoría.
6. Un comprobante observado/rechazado no se elimina antes de 7 días.
7. Un comprobante verificado no se elimina antes de activación + 7 días.
8. Retención suspendida excluye el objeto de todos los lotes.
9. Una retención liberada con plazo vencido vuelve a ser elegible en el siguiente ciclo.
10. Una eliminación exitosa repetida es idempotente.
11. Un fallo de Storage API se registra y reintenta en el siguiente ciclo.
12. Dos ejecuciones simultáneas no reclaman la misma fila.
13. La suspensión de retención no puede cruzarse con una eliminación ya reclamada.
14. La función no elimina ni consulta objetos del bucket `media`.
15. No se usa DELETE SQL sobre `storage.objects`.

## Límites

- Este diseño no despliega ni programa nada.
- No crea el bucket privado.
- No modifica bucket `media`, sus políticas ni triggers.
- No modifica `public.avisos`, flags, `campanas_destacado`, `admin.html` ni `js/admin.js`.
- No sustituye pruebas reales de Storage API, Cron, Vault y Edge Functions.
