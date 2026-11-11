import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return response({ success: false, error: 'Método no permitido' }, 405);

  const originHeader = req.headers.get('origin') || '';
  let origin: string;
  try {
    origin = new URL(originHeader).origin;
  } catch {
    return response({ success: false, error: 'Origen no válido' }, 403);
  }
  const allowedOrigins = new Set(['https://elbarrio.me', 'https://www.elbarrio.me']);
  if (!allowedOrigins.has(origin)) {
    return response({ success: false, error: 'Las notificaciones solo se registran desde El Barrio en producción' }, 403);
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Configuración incompleta de register-push');
    return response({ success: false, error: 'Servicio de notificaciones no disponible' }, 500);
  }

  const authorization = req.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+/i.test(authorization)) {
    return response({ success: false, error: 'Sesión no válida' }, 401);
  }

  try {
    // La identidad siempre se obtiene del token validado, nunca del cuerpo del cliente.
    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: authorization,
      },
    });
    if (!authResponse.ok) {
      return response({ success: false, error: 'Sesión expirada o no válida' }, 401);
    }
    const authUser = await authResponse.json();
    const userId = String(authUser?.id || '');
    if (!userId) return response({ success: false, error: 'No se pudo identificar la cuenta' }, 401);

    const body = await req.json();
    const endpoint = String(body?.endpoint || '').trim();
    const p256dh = String(body?.p256dh || '').trim();
    const auth = String(body?.auth || '').trim();
    const userAgent = String(body?.user_agent || '').slice(0, 1000);

    let endpointUrl: URL;
    try {
      endpointUrl = new URL(endpoint);
    } catch {
      return response({ success: false, error: 'Endpoint de notificación no válido' }, 400);
    }

    if (endpointUrl.protocol !== 'https:' || endpoint.length > 2048 || !p256dh || !auth) {
      return response({ success: false, error: 'Datos de suscripción incompletos o no válidos' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Un endpoint representa un único navegador. Se desactiva cualquier asociación
    // previa con otra cuenta antes de transferir su propiedad a la sesión autenticada.
    const { error: staleError } = await admin
      .from('push_subscriptions')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('endpoint', endpoint)
      .neq('usuario_id', userId)
      .eq('activo', true);

    if (staleError) throw staleError;

    const { data, error } = await admin
      .from('push_subscriptions')
      .upsert({
        usuario_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent,
        origen: origin,
        activo: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'usuario_id,endpoint' })
      .select('id,usuario_id,activo')
      .single();

    if (error) throw error;

    return response({
      success: true,
      subscription_id: data.id,
      usuario_id: data.usuario_id,
      activo: data.activo,
    });
  } catch (error) {
    console.error('register-push:', error);
    return response({
      success: false,
      error: error instanceof Error ? error.message : 'No se pudo registrar la suscripción',
    }, 500);
  }
});
