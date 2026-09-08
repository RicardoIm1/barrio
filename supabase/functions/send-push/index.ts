import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const PUSH_WEBHOOK_SECRET = Deno.env.get('PUSH_WEBHOOK_SECRET') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@elbarrio.me';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-elbarrio-push-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function respuesta(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function validarConfiguracion() {
  const faltantes = [];
  if (!SUPABASE_URL) faltantes.push('SUPABASE_URL');
  if (!SERVICE_ROLE_KEY) faltantes.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!VAPID_PUBLIC_KEY) faltantes.push('VAPID_PUBLIC_KEY');
  if (!VAPID_PRIVATE_KEY) faltantes.push('VAPID_PRIVATE_KEY');
  if (!PUSH_WEBHOOK_SECRET) faltantes.push('PUSH_WEBHOOK_SECRET');
  return faltantes;
}

function obtenerPayloadNotificacion(notificacion: any) {
  const tipo = notificacion.tipo;
  const tituloPorTipo: Record<string, string> = {
    like: 'A alguien le gustó tu aviso',
    dislike: 'Alguien marcó tu aviso como no recomendado',
    comentario: 'Nuevo comentario en tu aviso',
    sistema: 'El Barrio',
    aviso_aprobado: 'Tu aviso fue aprobado',
  };

  return {
    titulo: tituloPorTipo[tipo] || 'El Barrio',
    descripcion: notificacion.mensaje || tituloPorTipo[tipo] || 'Tienes una nueva notificación',
    url: notificacion.aviso_id
      ? `/aviso.html?id=${encodeURIComponent(notificacion.aviso_id)}`
      : '/index.html',
    aviso_id: notificacion.aviso_id || null,
    id: notificacion.id,
    tipo,
    tag: `el-barrio-${tipo}-${notificacion.aviso_id || notificacion.id}`,
    icono: '/icons/logo-elbarrio.png',
    badge: '/icons/logo-elbarrio.png',
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return respuesta({ success: false, error: 'Método no permitido' }, 405);

  const faltantes = validarConfiguracion();
  if (faltantes.length) {
    console.error('Configuración incompleta:', faltantes);
    return respuesta({ success: false, error: 'Configuración incompleta de Web Push' }, 500);
  }

  const secreto = req.headers.get('x-elbarrio-push-secret') || '';
  if (!secreto || secreto !== PUSH_WEBHOOK_SECRET) {
    return respuesta({ success: false, error: 'No autorizado' }, 401);
  }

  let body: any;
  try {
    body = await req.json();
  } catch (_) {
    return respuesta({ success: false, error: 'JSON inválido' }, 400);
  }

  const notificationId = body?.notification_id || body?.record?.id || body?.id;
  if (!notificationId) {
    return respuesta({ success: false, error: 'Falta notification_id' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const { data: notificacion, error: notificacionError } = await supabase
      .from('notificaciones')
      .select('id,usuario_id,tipo,mensaje,aviso_id,leida,fecha')
      .eq('id', notificationId)
      .maybeSingle();

    if (notificacionError) throw notificacionError;
    if (!notificacion) return respuesta({ success: false, error: 'Notificación no encontrada' }, 404);
    if (!notificacion.usuario_id) return respuesta({ success: true, enviados: 0, motivo: 'Sin destinatario' });

    const { data: suscripciones, error: suscripcionesError } = await supabase
      .from('push_subscriptions')
      .select('id,endpoint,p256dh,auth')
      .eq('usuario_id', notificacion.usuario_id)
      .eq('activo', true);

    if (suscripcionesError) throw suscripcionesError;

    if (!suscripciones?.length) {
      return respuesta({ success: true, enviados: 0, motivo: 'El usuario no tiene suscripciones activas' });
    }

    const payload = JSON.stringify(obtenerPayloadNotificacion(notificacion));
    let enviados = 0;
    let desactivados = 0;
    const errores: string[] = [];

    for (const suscripcion of suscripciones) {
      try {
        await webpush.sendNotification(
          {
            endpoint: suscripcion.endpoint,
            keys: {
              p256dh: suscripcion.p256dh,
              auth: suscripcion.auth,
            },
          },
          payload,
          {
            TTL: 60,
            urgency: 'high',
          },
        );
        enviados++;
      } catch (error: any) {
        const statusCode = Number(error?.statusCode || error?.status || 0);

        if (statusCode === 404 || statusCode === 410) {
          const { error: updateError } = await supabase
            .from('push_subscriptions')
            .update({ activo: false, updated_at: new Date().toISOString() })
            .eq('id', suscripcion.id);

          if (updateError) {
            console.error('No se pudo desactivar suscripción:', updateError);
          } else {
            desactivados++;
          }
        } else {
          console.error('Error enviando Web Push:', error);
          errores.push(`subscription:${suscripcion.id}:${statusCode || 'unknown'}`);
        }
      }
    }

    return respuesta({
      success: true,
      notificacion_id: notificationId,
      destinatario: notificacion.usuario_id,
      enviados,
      desactivados,
      errores,
    });
  } catch (error: any) {
    console.error('send-push error:', error);
    return respuesta({
      success: false,
      error: error?.message || 'Error interno enviando notificación push',
    }, 500);
  }
});
