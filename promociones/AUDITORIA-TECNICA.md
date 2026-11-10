# Auditoría técnica inicial: promociones

Fecha de revisión: 2026-11-10

Esta revisión fue de solo lectura. No se ejecutaron migraciones ni se modificó producción.

## Repositorio
- Repositorio: `RicardoIm1/barrio`
- Rama base: `main`
- Rama aislada: `feature/promociones-aprobadas`
- Archivos protegidos: `admin.html`, `js/admin.js`, portada y lógica existente de avisos.
- Confirmación en `js/admin.js`: el editor carga `edit-urgente` y `edit-destacado`, y solo permite modificarlos cuando el perfil autenticado tiene rol `admin`.

## Esquema confirmado
### `public.avisos`
- `id uuid primary key`, default `gen_random_uuid()`.
- `created_by uuid` referencia `public.usuarios(id)`.
- `titulo text not null`.
- `status text`, default `activo`; CHECK: `activo`, `pendiente`, `rechazado`, `eliminado`, `reportado`.
- `urgente boolean not null default false`.
- `destacado boolean default false`.
- Tiene métricas propias; la promoción no debe sobrescribirlas ni crear avisos duplicados.

### `public.usuarios`
- `id uuid primary key`.
- `rol` admite `usuario`, `admin`, `moderador`.
- `activo boolean`.
- El perfil se consulta con `id = auth.uid()` en el flujo actual.

### `public.campanas_destacado`
- Existe, tiene RLS habilitado y actualmente cero filas.
- Tiene relación con `avisos` y `usuarios`, plan, precio, fechas y estado.
- Se deja intacta. No se reutiliza ni elimina en esta etapa.

## Seguridad existente
- `private.es_admin()` es SECURITY DEFINER, usa `search_path = ''`, y valida que `auth.uid()` corresponda a un usuario con `rol='admin'` y cuenta activa.
- Los moderadores no son administradores comerciales.
- `private.proteger_campos_aviso()` impide a usuarios no administradores activar o modificar `urgente` y `destacado`.
- `public.proteger_campos_promocionales()` conserva los flags anteriores si quien escribe no es administrador.
- Ambos triggers siguen instalados en `public.avisos`. No modificarlos para implementar promociones.
- RLS está habilitado en `avisos`, `usuarios`, `campanas_destacado`, `storage.objects` y `storage.buckets`.

## Storage
- El único bucket actual es `media`, público, con límite configurado de 10 MB y MIME permitidos para imágenes y videos.
- La policy de subida actual limita los objetos a `media/avisos/{auth.uid()}/...`.
- El trigger `controlar_cuota_media_usuario()` solo actúa sobre el bucket `media` y la carpeta `avisos`; limita a 500 MB por usuario y valida MIME/extensiones.
- El bucket privado para comprobantes deberá ser independiente, con políticas de Storage específicas. No modificar la policy ni el trigger de `media`.

## Conteos observados
- Avisos: 84 activos y 19 eliminados.
- Ningún aviso activo tiene actualmente los flags urgente o destacado encendidos.
- Tres avisos eliminados conservan destacado=true.
- Campañas heredadas: cero registros.

## Decisiones de diseño derivadas
1. La solicitud debe relacionar `aviso_id` con `avisos.id` y `usuario_id` con `usuarios.id`.
2. El backend debe validar `created_by = auth.uid()` y que el aviso siga en estado `activo` al solicitar.
3. Solo `private.es_admin()` debe autorizar decisiones comerciales; no aceptar rol desde el navegador ni desde localStorage.
4. El flujo comercial no debe escribir `avisos.urgente` ni `avisos.destacado`.
5. La portada deberá leer la promoción comercial vigente por separado y combinarla con los flags administrativos existentes.
6. Los comprobantes deben quedar en un bucket privado nuevo, con rutas ligadas a UUID de usuario y solicitud.
7. Se deben guardar snapshots del producto/paquete/precio/duración y un historial append-only.
8. La expiración comercial no debe cambiar el estado editorial del aviso.

## Pendiente antes de redactar la migración
- Definir catálogo inicial, precios y duraciones de paquetes.
- Definir reglas exactas de aprobación/rechazo/solicitud de ajustes y cancelación.
- Definir si un usuario puede tener solicitudes paralelas del mismo tipo para el mismo aviso.
- Diseñar y revisar grants, RLS y RPCs de cada tabla.
- Definir políticas de Storage para carga, lectura privada y eliminación segura de comprobantes.
- Revisar el mecanismo de cron disponible y su rol de ejecución.
- Probar las reglas en una rama/proyecto de pruebas antes de aplicar en producción.

## Estado
Auditoría técnica inicial completada. Sin cambios de esquema, datos, policies, triggers, bucket o producción.
