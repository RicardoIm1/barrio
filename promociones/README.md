# Módulo de promociones de El Barrio

## Estado
Diseño inicial. Esta rama parte de `main` y mantiene aislado el desarrollo comercial.

## Objetivo
Permitir que una persona solicite promocionar uno de sus avisos mediante los productos **Destacado** y **Urgente**, con autorización editorial previa, pago manual y activación controlada por administración.

## Límite de seguridad
- No modificar `admin.html`, `js/admin.js` ni el flujo actual de edición de avisos.
- No retirar ni alterar los checks administrativos existentes `urgente` y `destacado`.
- No escribir desde el navegador directamente en esos campos como parte del flujo comercial.
- No modificar políticas, triggers, funciones ni tablas actuales hasta terminar la inspección y aprobar una migración revisada.
- No reutilizar ni eliminar `campanas_destacado` sin una decisión explícita basada en su uso real.
- No modificar la tabla de avisos, su contenido, métricas, comentarios, reacciones o medios para representar una promoción.

## Catálogo comercial
Consultar CATALOGO-COMERCIAL.md para precios y duraciones iniciales: Destacado $299 MXN por 30 días, Urgente $99 MXN por 7 días y paquete combinado $398 MXN con ambas duraciones independientes. El paquete combinado no tiene descuento de lanzamiento.

## Diseño de datos y estados
Consultar [DISENO-DATOS-Y-ESTADOS.md](./DISENO-DATOS-Y-ESTADOS.md) para la propuesta de entidades, reglas de acceso, estados, transiciones y funciones servidor. Es un diseño para revisión; todavía no hay migraciones ni cambios en Supabase.

## Modelo funcional previsto
1. El propietario elige uno de sus avisos y solicita Destacado, Urgente o ambos.
2. Elige un paquete y consulta precio, duración y condiciones.
3. La solicitud queda pendiente de revisión.
4. Administración aprueba, rechaza o solicita ajustes.
5. Si se aprueba, el usuario realiza transferencia o depósito y reporta el pago con comprobante.
6. Administración verifica el pago.
7. Administración activa la promoción. La vigencia comienza en ese momento.
8. El sistema registra la expiración y conserva el historial.

La solicitud, autorización y pago no activan por sí solos la promoción. La activación requiere una acción administrativa posterior a la verificación del pago.

## Separación de componentes
- Interfaz de usuario: `promocionar.html`.
- Consola administrativa comercial: `promociones-admin.html`.
- Lógica exclusiva del módulo: `js/promociones.js`.
- Esquema y migraciones: se incorporarán después de inspeccionar tipos, relaciones, RLS, grants, triggers y funciones existentes.

Los nombres anteriores son objetivos de diseño, no archivos desplegados todavía.

## Principios de datos y seguridad
- Cada solicitud debe validar en servidor que el usuario autenticado es propietario del aviso.
- La autorización y la validación del pago deben comprobar el rol administrativo real en servidor, no confiar en datos de `localStorage`.
- Las operaciones sensibles se implementarán mediante funciones seguras con permisos mínimos.
- Los comprobantes deberán almacenarse en un bucket privado separado de los medios públicos de avisos.
- Se guardarán snapshots de producto, paquete, precio, moneda y duración para conservar los términos aceptados.
- Se registrará un historial auditable de solicitudes, decisiones, pagos y activaciones.
- Una promoción comercial no debe sobrescribir los distintivos administrativos existentes.
- Destacado y Urgente podrán coexistir para un mismo aviso, con vigencias independientes.

## Integración futura en portada
La lectura de promociones vigentes se integrará de forma independiente. Antes de cambiar el orden o presentación del feed se deberá documentar la consulta actual, probar la nueva lectura y comprobar que los avisos con distintivos administrativos continúan comportándose igual.

## Punto de retorno
La rama `main` y el administrador actual constituyen la referencia funcional. Si una integración posterior altera el formulario de edición, sus checks o el guardado administrativo de Urgente/Destacado, se detiene la integración y se restaura el comportamiento de referencia.

## No incluido en esta etapa
- Migraciones SQL ejecutadas.
- Cambios en producción o despliegue.
- Cambios en `admin.html` o `js/admin.js`.
- Cambios en la portada.
- Cobros automáticos o pasarela de pago.
