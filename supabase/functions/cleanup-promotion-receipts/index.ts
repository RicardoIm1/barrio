import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SECRET_KEYS_RAW = Deno.env.get('SUPABASE_SECRET_KEYS') ?? '';
const LEGACY_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const secretKeys = SECRET_KEYS_RAW ? JSON.parse(SECRET_KEYS_RAW) : {};
const SERVICE_KEY = secretKeys.default || LEGACY_SERVICE_ROLE;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function pareceNoEncontrado(error: any) {
  const status = Number(error?.statusCode || error?.status || 0);
  const message = String(error?.message || '').toLowerCase();
  return status === 404 || message.includes('not found') || message.includes('object not found');
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return response({ success: false, error: 'Método no permitido' }, 405);
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Falta configuración de Supabase para la limpieza de comprobantes.');
    return response({ success: false, error: 'Configuración incompleta' }, 500);
  }

  const token = req.headers.get('x-cleanup-token') || '';
  if (!token) return response({ success: false, error: 'No autorizado' }, 401);

  const { data: autorizado, error: authError } = await admin.rpc(
    'validar_token_limpieza_comprobantes',
    { p_token: token },
  );

  if (authError || autorizado !== true) {
    console.warn('Intento no autorizado de limpieza de comprobantes.');
    return response({ success: false, error: 'No autorizado' }, 401);
  }

  const ahora = new Date().toISOString();
  const { data: pendientes, error: queryError } = await admin
    .from('pagos_promocion')
    .select('id,comprobante_path,comprobante_intentos')
    .not('comprobante_path', 'is', null)
    .lte('comprobante_retenido_hasta', ahora)
    .eq('retener_comprobante', false)
    .is('comprobante_eliminado_at', null)
    .order('comprobante_retenido_hasta', { ascending: true })
    .limit(100);

  if (queryError) {
    console.error('No se pudieron consultar comprobantes vencidos:', queryError.message);
    return response({ success: false, error: 'No se pudieron consultar comprobantes vencidos' }, 500);
  }

  let eliminados = 0;
  let errores = 0;

  for (const pago of pendientes || []) {
    const intentoAt = new Date().toISOString();
    const intento = Number(pago.comprobante_intentos || 0) + 1;

    const { error: removeError } = await admin.storage
      .from('comprobantes-promocion')
      .remove([pago.comprobante_path]);

    if (removeError && !pareceNoEncontrado(removeError)) {
      errores++;
      const { error: updateError } = await admin
        .from('pagos_promocion')
        .update({
          comprobante_intentos: intento,
          comprobante_ultimo_error: String(removeError.message || 'Error al eliminar comprobante').slice(0, 1000),
          comprobante_ultimo_intento_at: intentoAt,
          updated_at: intentoAt,
        })
        .eq('id', pago.id);

      if (updateError) console.error('No se pudo registrar el error de eliminación:', updateError.message);
      continue;
    }

    const { error: updateError } = await admin
      .from('pagos_promocion')
      .update({
        comprobante_eliminado_at: intentoAt,
        comprobante_intentos: intento,
        comprobante_ultimo_error: null,
        comprobante_ultimo_intento_at: intentoAt,
        updated_at: intentoAt,
      })
      .eq('id', pago.id);

    if (updateError) {
      errores++;
      console.error('El archivo se eliminó, pero no se pudo actualizar su auditoría:', updateError.message);
    } else {
      eliminados++;
    }
  }

  return response({
    success: errores === 0,
    procesados: (pendientes || []).length,
    eliminados,
    errores,
    ejecutado_en: ahora,
  });
});
