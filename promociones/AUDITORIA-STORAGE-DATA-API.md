# Auditoría de cuota Storage y exposición Data API

## Estado
Inspección de solo lectura del proyecto Supabase El Barrio. No se modificó configuración, SQL, Storage, RLS ni Data API.

Proyecto inspeccionado: `gnjaumpjerbbwlkcgxqa`.
Motor observado: PostgreSQL 17.6.
Fecha de revisión: 10 de noviembre de 2026.

## 1. Storage: estado observado

La consulta de solo lectura a `storage.buckets` devolvió un único bucket:

| Bucket | Público | Límite por bucket | MIME permitidos |
|---|---:|---:|---|
| `media` | Sí | 10,485,760 bytes (10 MiB) | JPEG, PNG, WebP, MP4, WebM y QuickTime |

No existe todavía el bucket `comprobantes-promociones`.

La documentación vigente de Supabase indica que el límite global en proyectos Free no puede superar 50 MB y que el límite de cada bucket no puede superar el global. El proyecto aparece en el contexto operativo como Free, pero la consulta de proyecto no devolvió el valor configurado actualmente en Storage Settings.

**Resultado:** el límite aprobado de 5,000,000 bytes es compatible con el máximo global permitido en Free. Sin embargo, el valor global actualmente configurado no pudo verificarse mediante las herramientas disponibles. Antes de crear el bucket se debe revisar Storage > Settings > Global file size limit en el Dashboard. No cambiar el límite del bucket `media`.

Documentación: https://supabase.com/docs/guides/storage/uploads/file-limits

## 2. Data API: privilegios observados

La consulta SQL de solo lectura confirmó:

- Los roles `anon`, `authenticated` y `service_role` tienen USAGE sobre el esquema `public`.
- `anon` tiene SELECT sobre `public.avisos`.
- `authenticated` tiene SELECT, INSERT, UPDATE y DELETE a nivel de privilegios SQL sobre `public.avisos`. La autorización efectiva de filas continúa dependiendo de RLS y de las policies.
- Los privilegios por defecto registrados para objetos creados por los roles `postgres` y `supabase_admin` en `public` incluyen:
  - Tablas: privilegios amplios para `anon`, `authenticated` y `service_role`.
  - Funciones: EXECUTE para `anon`, `authenticated` y `service_role`.
  - Secuencias: privilegios para esos mismos roles.

Estos privilegios por defecto son especialmente importantes: si las tablas y funciones comerciales se crean con esos propietarios, podrían heredar permisos amplios si la migración no los revoca expresamente.

## 3. Consecuencia para el módulo de promociones

La migración propuesta no debe confiar en los privilegios por defecto del proyecto.

Criterios obligatorios para la futura migración:

1. Crear tablas nuevas con RLS habilitado en la misma migración.
2. Revocar explícitamente los privilegios por defecto de `anon` y `authenticated` sobre las tablas comerciales, secuencias y funciones.
3. Conceder solo los permisos estrictamente necesarios para los puntos de entrada públicos previstos.
4. Mantener las tablas internas inaccesibles por acceso directo del navegador.
5. No conceder acceso directo general a `pagos_promocion`, comprobantes, bitácora ni tablas internas.
6. Revisar por separado EXECUTE de cada RPC y función auxiliar. No dejar funciones SECURITY DEFINER ejecutables por PUBLIC.
7. Verificar que RLS esté habilitado y probar los permisos efectivos por rol después de la migración.
8. No crear policies permisivas superpuestas en `storage.objects`; recordar que las policies PERMISSIVE se combinan mediante OR.

La arquitectura de funciones y permisos deberá revisarse antes de generar la migración final. En particular, el diseño de wrappers SECURITY INVOKER debe ser coherente con la revocación de acceso directo a tablas: las operaciones privilegiadas deberán quedar encapsuladas en funciones internas no expuestas y con autorización explícita, sin abrir acceso general a las tablas.

## 4. Ajuste de la propuesta de funciones

El proyecto conserva privilegios por defecto de EXECUTE para funciones nuevas. Por tanto, cada función nueva debe incluir revocación explícita de EXECUTE a PUBLIC y a los roles API, seguida de GRANT solo al rol que corresponda. No se debe asumir que una función dentro de un esquema privado queda protegida solo por su nombre o ubicación: también se revisarán USAGE del esquema y EXECUTE.

## 5. Limitación de verificación del Dashboard

Las herramientas de inspección SQL y de proyecto no exponen el valor actual de:
- Storage Settings > Global file size limit.
- La opción del Dashboard que controla la exposición automática de tablas y funciones nuevas a Data API/GraphQL.

El cambio de Supabase anunciado el 28 de abril de 2026 se aplica a proyectos existentes desde el 30 de octubre de 2026: las tablas nuevas de `public` requieren GRANT explícito para ser visibles por Data API. Los grants PostgreSQL y RLS son controles separados.

Como el proyecto sí conserva privilegios por defecto amplios en PostgreSQL, la migración deberá revocarlos de forma explícita. La configuración visual de exposición automática deberá confirmarse en el Dashboard antes de implementar; no se puede inferir de los grants observados.

Documentación: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically

## 6. Límites de esta auditoría

- Solo consultas SELECT y lectura de metadatos.
- No se alteraron grants, roles, RLS, policies, tablas, funciones, buckets ni límites.
- No se creó el bucket de comprobantes.
- No se ejecutó ninguna migración.
- No se modificó `admin.html`, `js/admin.js`, `public.avisos`, `campanas_destacado` ni el bucket `media`.

## 7. Pendientes antes de implementar

1. Confirmar visualmente en Dashboard el límite global de Storage.
2. Confirmar visualmente el ajuste de exposición automática de Data API/GraphQL.
3. Revisar y corregir el borrador SQL para neutralizar los privilegios por defecto antes de crear objetos comerciales.
4. Cerrar el diseño de privilegios de RPCs y funciones internas, manteniendo las tablas comerciales sin acceso directo desde el navegador.
5. Preparar una matriz de pruebas de GRANT, RLS, RPC y Storage antes de cualquier ejecución.
