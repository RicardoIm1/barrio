-- Las RPCs comerciales se invocan desde sesiones autenticadas con validación interna.
-- El rol service_role no necesita invocarlas y queda explícitamente excluido.
revoke all on function public.crear_solicitud_promocion(uuid,text,uuid,text) from service_role;
revoke all on function public.reportar_pago_promocion(uuid,text,text,text) from service_role;
revoke all on function public.admin_revisar_solicitud_promocion(uuid,text,text) from service_role;
revoke all on function public.admin_validar_pago_promocion(uuid,text,text) from service_role;
revoke all on function public.admin_registrar_activacion_promocion(uuid) from service_role;
revoke all on function public.admin_configurar_retiro_promocion(uuid,boolean) from service_role;
