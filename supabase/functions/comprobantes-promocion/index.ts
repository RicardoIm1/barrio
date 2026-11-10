import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const BUCKET = 'comprobantes-promociones';
const MAX_BYTES = 5_000_000;
const URL_TTL_SECONDS = 90;

const allowedOrigins = new Set(
  (Deno.env.get('PROMOCIONES_ALLOWED_ORIGINS') || 'https://elbarrio.me')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };

  if (origin && allowedOrigins.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

function response(
  body: unknown,
  status: number,
  origin: string | null,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function uuidValido(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function detectarMime(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) return 'image/jpeg';

  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (
    bytes.length >= 8 &&
    png.every((value, index) => bytes[index] === value)
  ) return 'image/png';

  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) return 'image/webp';

  if (bytes.length >= 8) {
    const header = new TextDecoder().decode(bytes.slice(0, 8));
    const tailStart = Math.max(0, bytes.length - 1024);
    const tail = new TextDecoder().decode(bytes.slice(tailStart));
    if (header.startsWith('%PDF-') && tail.includes('%%EOF')) {
      return 'application/pdf';
    }
  }

  return null;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function crearClienteUsuario(token: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function crearClienteServicio() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    if (origin && !allowedOrigins.has(origin)) {
      return response({ success: false, error: 'Origen no autorizado' }, 403, origin);
    }
    return new Response('ok', {
      status: 200,
      headers: corsHeaders(origin),
    });
  }

  if (req.method !== 'POST') {
    return response({ success: false, error: 'Método no permitido' }, 405, origin);
  }

  if (origin && !allowedOrigins.has(origin)) {
    return response({ success: false, error: 'Origen no autorizado' }, 403, origin);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
    console.error('Configuración incompleta en comprobantes-promocion');
    return response({ success: false, error: 'Servicio temporalmente no disponible' }, 500, origin);
  }

  const authorization = req.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return response({ success: false, error: 'Sesión requerida' }, 401, origin);
  }

  const token = match[1];
  const userClient = crearClienteUsuario(token);
  const { data: authData, error: authError } = await userClient.auth.getUser(token);

  if (authError || !authData?.user) {
    return response({ success: false, error: 'Sesión no válida' }, 401, origin);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return response({ success: false, error: 'Solicitud JSON no válida' }, 400, origin);
  }

  const action = body?.accion;
  const paymentId = body?.pago_id;

  if (!uuidValido(paymentId)) {
    return response({ success: false, error: 'Identificador de pago no válido' }, 400, origin);
  }

  const serviceClient = crearClienteServicio();

  try {
    if (action === 'url_admin') {
      // La RPC verifica admin activo y devuelve solo la ruta interna.
      const { data: fileInfo, error: routeError } = await userClient.rpc(
        'obtener_ruta_comprobante_admin',
        { p_pago_id: paymentId },
      );

      if (routeError || !fileInfo?.path || fileInfo.bucket !== BUCKET) {
        return response({ success: false, error: 'Comprobante no disponible' }, 404, origin);
      }

      const { data: signed, error: signedError } = await serviceClient.storage
        .from(BUCKET)
        .createSignedUrl(fileInfo.path, URL_TTL_SECONDS, {
          download: true,
        });

      if (signedError || !signed?.signedUrl) {
        console.error('No fue posible emitir acceso temporal al comprobante');
        return response({ success: false, error: 'No fue posible abrir el comprobante' }, 500, origin);
      }

      // La URL firmada no se persiste ni se escribe en logs.
      return response({
        success: true,
        url: signed.signedUrl,
        expires_in_seconds: URL_TTL_SECONDS,
        mime: fileInfo.mime,
      }, 200, origin);
    }

    if (action !== 'validar') {
      return response({ success: false, error: 'Acción no válida' }, 400, origin);
    }

    // La RPC valida propietario, estado y vencimiento de la reserva.
    const { data: claim, error: claimError } = await userClient.rpc(
      'iniciar_validacion_comprobante',
      { p_pago_id: paymentId },
    );

    if (claimError) {
      return response({ success: false, error: 'No se pudo iniciar la validación del comprobante' }, 409, origin);
    }

    if (claim?.ya_validado) {
      return response({ success: true, estado: 'reportado', ya_validado: true }, 200, origin);
    }

    if (!claim?.path || claim.bucket !== BUCKET) {
      return response({ success: false, error: 'Reserva de comprobante no válida' }, 409, origin);
    }

    const { data: file, error: downloadError } = await serviceClient.storage
      .from(BUCKET)
      .download(claim.path);

    if (downloadError || !file) {
      await serviceClient.rpc('finalizar_validacion_comprobante', {
        p_pago_id: paymentId,
        p_resultado: 'error',
        p_codigo: 'storage_download_failed',
      });

      return response({ success: false, error: 'No se pudo leer el archivo cargado. Puedes intentar nuevamente mientras la reserva siga vigente.' }, 422, origin);
    }

    let invalidCode: string | null = null;
    let bytes = new Uint8Array();

    if (file.size < 1) {
      invalidCode = 'archivo_vacio';
    } else if (file.size > MAX_BYTES) {
      invalidCode = 'tamano_excedido';
    } else {
      bytes = new Uint8Array(await file.arrayBuffer());
      const detected = detectarMime(bytes);

      if (!detected) {
        invalidCode = 'firma_no_reconocida';
      } else if (detected !== claim.mime_declarado) {
        invalidCode = 'mime_no_coincide';
      } else {
        const hash = await sha256Hex(bytes);

        const { data: finalized, error: finalizeError } = await serviceClient.rpc(
          'finalizar_validacion_comprobante',
          {
            p_pago_id: paymentId,
            p_resultado: 'valido',
            p_mime_detectado: detected,
            p_bytes: bytes.byteLength,
            p_sha256: hash,
            p_codigo: 'validacion_correcta',
          },
        );

        if (finalizeError || !finalized) {
          console.error('No fue posible registrar la validación correcta');
          return response({ success: false, error: 'La validación quedó pendiente de recuperación. Intenta nuevamente en unos minutos.' }, 503, origin);
        }

        return response({
          success: true,
          estado: 'reportado',
          mensaje: 'Comprobante recibido y validado. Está pendiente de revisión administrativa.',
        }, 200, origin);
      }
    }

    // Los archivos inválidos se eliminan exclusivamente mediante Storage API.
    const { error: removeError } = await serviceClient.storage
      .from(BUCKET)
      .remove([claim.path]);

    if (removeError) {
      // El estado invalido impide su revisión. La limpieza diaria deberá
      // reintentar la eliminación por Storage API.
      console.error('La eliminación de un comprobante inválido quedó pendiente');
    }

    const { error: invalidFinalizeError } = await serviceClient.rpc(
      'finalizar_validacion_comprobante',
      {
        p_pago_id: paymentId,
        p_resultado: 'invalido',
        p_codigo: invalidCode,
        p_bytes: file.size,
      },
    );

    if (invalidFinalizeError) {
      console.error('No fue posible registrar el comprobante inválido');
      return response({ success: false, error: 'El archivo no superó la validación y el registro quedó pendiente de recuperación.' }, 503, origin);
    }

    // Registrar el borrado inmediato; si Storage API falló, la limpieza diaria
    // conservará el intento como elegible y volverá a probar.
    const { error: deletionRecordError } = await serviceClient.rpc(
      'registrar_borrado_comprobante',
      {
        p_pago_id: paymentId,
        p_exito: !removeError,
        p_codigo_error: removeError ? 'storage_remove_failed' : null,
      },
    );

    if (deletionRecordError) {
      console.error('No fue posible registrar el resultado del borrado inmediato');
    }

    return response({
      success: false,
      estado: 'invalido',
      error: 'El archivo no cumple con el formato o tamaño permitido. Genera un nuevo intento para cargar otro comprobante.',
    }, 422, origin);
  } catch (error) {
    console.error('Error controlado en comprobantes-promocion:', String((error as Error)?.name || 'Error'));
    return response({ success: false, error: 'No fue posible completar la operación. Intenta nuevamente.' }, 500, origin);
  }
});
