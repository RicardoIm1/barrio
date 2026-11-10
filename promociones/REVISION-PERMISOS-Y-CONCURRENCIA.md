# Revisión del borrador SQL, permisos y concurrencia

## Estado
Revisión documental de solo lectura del borrador `sql/001_esquema_base_propuesta.sql` y de `DISENO-RPCS-Y-CONCURRENCIA.md`. Rama: `feature/promociones-aprobadas`.

No se ejecutó SQL ni se modificó Supabase. Este documento no autoriza una migración a producción.

## 1. Hallazgo crítico: orden de bloqueo inconsistente

El diseño de `activar_promocion(p_solicitud_id)` bloqueaba primero la solicitud y después el aviso. Sin embargo, la regla general de concurrencia establece aviso → solicitud. Esto abre una posibilidad de deadlock frente a otra operación que ya haya bloqueado el aviso y espere la solicitud.

### Orden obligatorio corregido
Para operaciones que requieran ambos registros:
1. Obtener `aviso_id` de la solicitud mediante una lectura preliminar sin conservar bloqueo.
2. Bloquear la fila de `public.avisos` con `SELECT ... FOR UPDATE`.
3. Bloquear la fila de `public.solicitudes_promocion` con `SELECT ... FOR UPDATE`.
4. Volver a comprobar que la solicitud sigue asociada al mismo aviso, que está en el estado esperado y que existe un pago verificado.
5. Validar que el aviso sigue activo y ejecutar la activación dentro de la misma transacción.

La lectura preliminar no autoriza ninguna decisión. Todos los datos relevantes se vuelven a validar después de adquirir los bloqueos. Si la relación cambió o el estado ya no corresponde, la función falla sin mutaciones.

Este orden debe ser compartido por cualquier operación futura que necesite bloquear aviso y solicitud. Las operaciones que solo necesitan la solicitud pueden bloquearla directamente, siempre que no intenten adquirir después el aviso.

## 2. Permisos SQL: RLS no sustituye GRANT/REVOKE

La auditoría real encontró privilegios predeterminados amplios para objetos nuevos creados por los propietarios observados en `public`. El borrador actual revoca permisos de tablas a `anon` y `authenticated`, lo cual es una buena barrera inicial, pero la migración definitiva debe hacer explícito el cierre de privilegios en cada objeto.

### Requisitos para la migración
- Aplicar `REVOKE ALL` sobre cada tabla comercial recién creada a `PUBLIC`, `anon` y `authenticated`, y conceder después únicamente lo que el diseño final requiera.
- Mantener las tablas internas sin acceso directo desde el navegador. No otorgar SELECT/INSERT/UPDATE/DELETE general a clientes.
- Evaluar y declarar explícitamente los privilegios de `service_role`; no confundirlo con un rol de usuario final. Solo procesos de servidor confiables deben usar credenciales de servicio.
- Si se crean secuencias, revocar sus privilegios por defecto a los roles API y conceder solo lo indispensable. El borrador UUID actual no crea secuencias propias.
- Para cada función nueva, revocar EXECUTE de `PUBLIC`, `anon` y `authenticated` explícitamente; conceder EXECUTE únicamente al rol que deba invocarla. PostgreSQL concede EXECUTE a PUBLIC por defecto en funciones nuevas si no se revoca.
- Las funciones internas privilegiadas deben usar `SECURITY DEFINER`, `SET search_path = ''`, nombres cualificados y validación explícita de identidad/rol.
- No asumir que un wrapper `SECURITY INVOKER` puede llamar una función interna o manipular tablas sin los privilegios correspondientes. La cadena completa de EXECUTE, USAGE de esquema y permisos de objetos debe probarse con roles reales.
- Evitar cambios globales a `ALTER DEFAULT PRIVILEGES` en esta etapa: podrían afectar objetos ajenos al módulo. Preferir revocaciones explícitas y verificables por objeto dentro de la migración.
- Mantener RLS habilitado en todas las tablas comerciales, incluso si inicialmente no hay policies de cliente.
- No crear policies permisivas superpuestas. Las policies PERMISSIVE se combinan mediante OR.

## 3. Robustez del borrador SQL

### Evitar `CREATE TABLE IF NOT EXISTS` en la migración versionada
Para una migración de producción, usar creación normal de objetos y dejar que la operación falle si encuentra un objeto preexistente inesperado. `IF NOT EXISTS` puede ocultar una tabla preexistente con estructura incompatible y permitir que la migración continúe bajo una falsa apariencia de éxito.

La idempotencia debe provenir del control de versiones de migraciones, no de ocultar diferencias de esquema.

### Catálogo y snapshots
Los snapshots de nombre, tipo, precio, moneda y duración en los componentes de solicitud son necesarios para conservar el acuerdo comercial aunque el catálogo cambie. La futura RPC debe obtener los valores exclusivamente del catálogo servidor y no aceptar importes o duraciones calculados por el navegador.

### Índices únicos parciales
Los índices propuestos protegen:
- una promoción programada/activa por aviso y tipo;
- un pago verificado por solicitud.

La RPC de activación debe marcar primero como vencidas las promociones cuyo plazo terminó, dentro de la misma transacción, antes de insertar. El reloj no cambia por sí solo el valor de `estado`, por lo que el índice no interpreta automáticamente que una fila ya venció.

### Bitácora
El campo JSON de detalle debe tener una lista permitida de atributos por evento. No debe almacenar comprobantes, URLs firmadas, secretos, tokens ni datos bancarios innecesarios. La bitácora debe ser append-only para los roles de cliente y no debe aceptar eventos fabricados desde el navegador.

## 4. Compatibilidad entre estados y operaciones

Antes de implementar las RPC se requiere una matriz única que valide:
- `pago_observado` permite corregir y reenviar un intento de pago conforme al flujo definido.
- Un pago rechazado devuelve la solicitud a `aprobada_pendiente_pago`, conservando el intento anterior.
- Un pago verificado no se considera promoción activa hasta la operación administrativa de activación.
- Si el aviso ya no está activo al activar, la solicitud pasa a `revision_administrativa` y no se crea ningún componente.
- Cancelación de usuario solo procede desde `pendiente_revision` o `requiere_ajustes`.
- La expiración de componentes no altera `public.avisos.urgente` ni `public.avisos.destacado`.

La retención del comprobante verificado se calcula desde la activación + 7 días naturales. Para comprobantes observados/rechazados se calcula desde la decisión administrativa + 7 días naturales. Una incidencia o revisión pendiente suspende la eliminación.

## 5. Decisiones de arquitectura recomendadas

1. Mantener las seis tablas comerciales en `public` solo si todas permanecen sin grants directos a los roles API; alternativamente evaluar un esquema no expuesto. La elección debe ser consistente con PostgREST, las RPC y el despliegue real.
2. Exponer únicamente RPC públicas estrictamente necesarias. Cada RPC debe delegar en lógica privilegiada que valide autorización y parámetros.
3. Mantener las funciones internas en un esquema no expuesto y comprobar que solo los wrappers autorizados y los procesos de servidor pueden ejecutarlas.
4. Separar funciones de usuario, funciones administrativas y funciones de sistema. Moderador no equivale a administrador.
5. Probar con sesiones reales de anon, authenticated usuario A, authenticated usuario B, moderador, admin y service_role antes de cualquier despliegue.

## 6. Elementos que siguen fuera de alcance

- No ejecutar el SQL.
- No crear tablas, funciones, policies, vistas, bucket, cron ni Edge Functions.
- No cambiar la configuración global de Storage o Data API.
- No modificar `admin.html`, `js/admin.js`, `public.avisos`, `campanas_destacado`, triggers existentes ni el bucket `media`.

## Conclusión

El borrador es una base de modelado, no una migración lista para ejecutar. Los dos bloqueos principales antes de implementarlo son: corregir el orden de bloqueo de activación y diseñar una matriz explícita de privilegios por objeto y función. Después debe construirse una migración versionada que falle ante drift, y probarse en un entorno aislado con cada rol relevante.


## 7. Resultado de la revisión del esquema

Se reemplazó el borrador SQL inicial por una propuesta más estricta en `sql/001_esquema_base_propuesta.sql`:

- Se eliminaron `IF NOT EXISTS` para que una estructura preexistente inesperada provoque error en vez de ocultar drift.
- Se revocaron privilegios directos a `PUBLIC`, `anon`, `authenticated` y `service_role` en las seis tablas nuevas.
- RLS se habilita en cada tabla. No se crean policies hasta definir RPC y lecturas seguras.
- Se separaron `estado_pago` y `estado_carga` para representar reserva, validación y revisión sin confundir una carga incompleta con un pago reportado.
- Se añadieron metadatos de validación: MIME declarado/detectado, bytes, hash SHA-256 y reserva con expiración de 30 minutos.
- Se añadieron claves foráneas compuestas para reforzar la consistencia entre aviso, solicitud, componente, pago, promoción y bitácora.
- Se mantuvieron snapshots de catálogo, unicidad de promociones vigentes por aviso/tipo y un único pago verificado por solicitud.
- No se alteraron default privileges globales ni objetos existentes.

**Verificación:** se revisó el texto y sus relaciones a nivel estático. No se ejecutó en PostgreSQL, no se creó una rama de base de datos Supabase y no se probó contra un motor real. La propuesta no debe considerarse sintáctica ni operacionalmente validada hasta probarla en una base aislada con los roles y extensiones del proyecto.


## 8. Verificación estática realizada

Se recuperó el archivo desde GitHub después de actualizarlo y se comprobaron automáticamente estas condiciones:

- Paréntesis balanceados.
- Seis instrucciones de creación de tabla.
- RLS habilitado en las seis tablas.
- Ausencia de `CREATE TABLE IF NOT EXISTS`.
- Revocación explícita de privilegios de las seis tablas a `PUBLIC`, `anon`, `authenticated` y `service_role`.
- Separación de `estado_pago` y `estado_carga`.
- Ausencia de instrucciones que alteren `public.avisos`.
- Ausencia de escrituras sobre el esquema `storage`.
- Bloque transaccional `BEGIN/COMMIT`.

Los nueve controles estáticos pasaron. Esto detecta errores estructurales básicos, pero **no equivale a validar la sintaxis y ejecución en PostgreSQL**. Aún faltan una prueba real en una base aislada, comprobación de permisos efectivos y pruebas de RPC/RLS/Storage. No se ejecutó ninguna instrucción SQL contra el proyecto conectado.
