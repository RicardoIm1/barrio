import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CLEANUP_SECRET = Deno.env.get('PROMOCIONES_CLEANUP_SECRET') ?? '';
const BUCKET = 'comprobantes-promociones';
const BATCH_SIZE = 20;
const MAX_BATCHES = 20;

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

async function sha256(value: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(value);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

async function secretoCoincide(received: string, expected: string): Promise<boolean> {
  if (!received || !expected) return false;
  const a = await sha256(received);
  const b = await sha256(expected);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return response({ success: false, error: 'Método no permitido' }, 405);
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !CLEANUP_SECRET) {
    console.error('Configuración incompleta en limpieza de comprobantes');
    return response({ success: false, error: 'Servicio no disponible' }, 500);
  }

  const suppliedSecret = req.headers.get('x-cleanup-secret') || '';
  if (!(await secretoCoincide(suppliedSecret, CLEANUP_SECRET))) {
    return response({ success: false, error: 'No autorizado' }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let reclamados = 0;
  let eliminados = 0;
  let fallidos = 0;

  try {
    for (let batch = 0; batch < MAX_BATCHES; batch++) {
      const { data: items, error: claimError } = await supabase.rpc(
        'reclamar_comprobantes_para_limpieza',
        { p_limit: BATCH_SIZE },
      );

      if (claimError) {
        console.error('No se pudo reclamar el lote de limpieza');
        return response({
          success: false,
          reclamados,
          eliminados,
          fallidos,
          error: 'No se pudo obtener el lote de limpieza',
        }, 500);
      }

      if (!Array.isArray(items) || items.length === 0) break;

      for (const item of items) {
        reclamados++;

        if (!item?.pago_id || !item?.path) {
          fallidos++;
          continue;
        }

        const { error: removeError } = await supabase.storage
          .from(BUCKET)
          .remove([item.path]);

        const { error: recordError } = await supabase.rpc(
          'registrar_borrado_comprobante',
          {
            p_pago_id: item.pago_id,
            p_exito: !removeError,
            p_codigo_error: removeError ? 'storage_remove_failed' : null,
          },
        );

        if (recordError) {
          fallidos++;
          console.error('No se pudo registrar el resultado de limpieza');
          continue;
        }

        if (removeError) {
          fallidos++;
        } else {
          eliminados++;
        }
      }

      if (items.length < BATCH_SIZE) break;
    }

    return response({
      success: fallidos === 0,
      reclamados,
      eliminados,
      fallidos,
    }, fallidos === 0 ? 200 : 207);
  } catch (error) {
    console.error('Fallo controlado en limpieza de comprobantes:', String((error as Error)?.name || 'Error'));
    return response({
      success: false,
      reclamados,
      eliminados,
      fallidos,
      error: 'La limpieza no pudo completarse',
    }, 500);
  }
});
