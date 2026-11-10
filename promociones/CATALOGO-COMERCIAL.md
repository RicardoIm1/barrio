# Catálogo comercial inicial de promociones

## Estado
Propuesta comercial inicial aprobada para documentar y validar. No está conectada a cobros ni a activación automática.

## Moneda y criterio de vigencia
- Moneda: pesos mexicanos (MXN).
- Los precios son importes nominales iniciales. No se ha definido todavía un tratamiento fiscal ni una política de facturación.
- La vigencia empieza únicamente cuando administración activa la promoción después de verificar el pago.
- Solicitar, aprobar o reportar un pago no inicia el contador de vigencia.

## Productos

| Clave | Producto | Precio | Duración |
|---|---|---:|---:|
| DEST-30 | Aviso destacado | $299 MXN | 30 días |
| URG-7 | Aviso urgente | $99 MXN | 7 días |
| COMBO-30-7 | Destacado + urgente | $398 MXN | 30 días destacado + 7 días urgente |

## Reglas del paquete combinado
- El paquete combinado suma los precios individuales: $299 + $99 = $398 MXN.
- No incluye descuento en el lanzamiento.
- Cada componente conserva su propia duración. El destacado dura 30 días y el urgente 7 días, ambos contados desde la activación administrativa.
- Ambos distintivos pueden coexistir y expirar por separado.
- No se prorroga ni reinicia una vigencia por editar el aviso.
- No se altera el aviso original, su estado, sus métricas ni sus interacciones.

## Flujo de contratación
1. El propietario selecciona uno de sus avisos activos.
2. Selecciona Destacado, Urgente o el paquete combinado.
3. El sistema muestra precio, duración y condiciones antes de enviar la solicitud.
4. La solicitud queda pendiente de revisión administrativa.
5. Administración puede aprobar, rechazar o solicitar ajustes.
6. Después de la aprobación, el usuario realiza transferencia o depósito y adjunta el comprobante.
7. Administración verifica el comprobante y el importe.
8. Solo después de verificar el pago, administración activa la promoción.
9. El sistema conserva fechas de activación y expiración por componente y registra los eventos en el historial.

## Estados conceptuales
- pendiente_revision: solicitud recibida.
- requiere_ajustes: requiere cambios antes de autorizar.
- rechazada: solicitud no autorizada.
- aprobada_pendiente_pago: autorizada, aún sin pago verificado.
- pago_reportado: usuario adjuntó comprobante.
- pago_observado: comprobante o importe requiere aclaración.
- pago_verificado: pago comprobado, pendiente de activación.
- activa: promoción activada por administración.
- vencida: terminó la vigencia de todos sus componentes.
- cancelada: cancelada conforme a una decisión administrativa registrada.

Los estados son una propuesta de dominio; antes de implementarlos se revisarán transiciones válidas, concurrencia, reintentos y auditoría.

## Decisiones pendientes antes de cobrar
- Datos bancarios y titular de la cuenta receptora.
- Política de comprobantes, formatos y tamaño máximo.
- Política de cancelación, reembolso y solicitudes duplicadas.
- Tratamiento fiscal y emisión de comprobantes fiscales, si aplica.
- Texto final de términos y condiciones mostrado al usuario.
- Si se permitirán varias promociones simultáneas para el mismo aviso y cómo se resolverán traslapes.
- Canal de notificación al usuario cuando se apruebe, observe o active su solicitud.

## Límites técnicos
- Este catálogo no autoriza modificar avisos.urgente ni avisos.destacado.
- Los distintivos comerciales se almacenarán en entidades independientes.
- El administrador comercial será un módulo separado del admin.html existente.
- No se reutiliza campanas_destacado en esta etapa.
- No se ejecutan migraciones SQL ni se realizan cambios en producción como parte de este documento.