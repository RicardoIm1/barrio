import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@elbarrio.me';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function respuesta(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function validarConfiguracion() {
  const faltantes: string[] = [];
  if (!SUPABASE_URL) faltantes.push('SUPABASE_URL');
  if (!SERVICE_ROLE_KEY) faltantes.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!VAPID_PUBLIC_KEY) faltantes.push('VAPID_PUBLIC_KEY');
  if (!VAPID_PRIVATE_KEY) faltantes.push('VAPID_PRIVATE_KEY');
  return faltantes;
}

function autorizado(req: Request) {
  const apiKey = req.headers.get('apikey') || '';
  const authorization = req.headers.get('authorization') || '';
  return (
    apiKey === SERVICE_ROLE_KEY ||
    authorization === `Bearer ${SERVICE_ROLE_KEY}`
  );
}

function obtenerStatusCode(error: any) {
  return Number(error?.statusCode || error?.status || 0);
}

function obtenerMensajeError(error: any) {
  const body = error?.body;

  if (typeof body === 'string' && body.trim()) return body.trim();

  if (body && typeof body === 'object') {
    try {
      return JSON.stringify(body);
    } catch (_) {}
  }

  return typeof error?.message === 'string' ? error.message : '';
}

function obtenerHost(endpoint: string) {
  try {
    return new URL(endpoint).hostname;
  } catch (_) {
    return 'host-desconocido';
  }
}

function obtenerPayloadNotificacion(notificacion: any) {
  const tituloPorTipo: Record<string, string> = {
    like: 'A alguien le gustó tu aviso',
    dislike: 'Alguien marcó tu aviso como no recomendado',
    comentario: 'Nuevo comentario en tu aviso',
  };

  return {
    titulo: tituloPorTipo[notificacion.tipo] || 'El Barrio',
    descripcion:
      notificacion.mensaje ||
      tituloPorTipo[notificacion.tipo] ||
      'Tienes una nueva notificación',
    url: notificacion.aviso_id
      ? `/aviso.html?id=${encodeURIComponent(notificacion.aviso_id)}`
      : '/index.html',
    aviso_id: notificacion.aviso_id || null,
    id: notificacion.id,
    tipo: notificacion.tipo,
    tag: `el-barrio-${notificacion.tipo}-${notificacion.aviso_id || notificacion.id}`,
    icono: '/icons/logo-elbarrio.png',
    badge: '/icons/logo-elbarrio.png',
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return respuesta({ success: false, error: 'Método no permitido' }, 405);
  }

  const faltantes = validarConfiguracion();

  if (faltantes.length) {
    console.error('Configuración incompleta:', faltantes);
    return respuesta(
      { success: false, error: 'Configuración incompleta de Web Push' },
      500,
    );
  }

  if (!autorizado(req)) {
    return respuesta({ success: false, error: 'No autorizado' }, 401);
  }

  let body: any;

  try {
    body = await req.json();
  } catch (_) {
    return respuesta({ success: false, error: 'JSON inválido' }, 400);
  }

  const notificationId =
    body?.notification_id || body?.record?.id || body?.id;

  if (!notificationId) {
    return respuesta({ success: false, error: 'Falta notification_id' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: reclamada, error: reclamoError } = await supabase.rpc(
      'reclamar_push_entrega',
      { p_notification_id: notificationId },
    );

    if (reclamoError) throw reclamoError;

    if (!reclamada) {
      return respuesta({
        success: true,
        notification_id: notificationId,
        motivo: 'Entrega ya procesada o actualmente en procesamiento',
      });
    }

    webpush.setVapidDetails(
      VAPID_SUBJECT,
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY,
    );

    const { data: notificacion, error: notificacionError } = await supabase
      .from('notificaciones')
      .select('id,usuario_id,tipo,mensaje,aviso_id,leida,fecha')
      .eq('id', notificationId)
      .maybeSingle();

    if (notificacionError) throw notificacionError;

    if (!notificacion) {
      await supabase.rpc('finalizar_push_entrega', {
        p_notification_id: notificationId,
        p_estado: 'fallido',
        p_enviados: 0,
        p_desactivados: 0,
        p_ultimo_error: 'Notificación no encontrada',
      });

      return respuesta(
        { success: false, error: 'Notificación no encontrada' },
        404,
      );
    }

    if (!['like', 'dislike', 'comentario'].includes(notificacion.tipo)) {
      await supabase.rpc('finalizar_push_entrega', {
        p_notification_id: notificationId,
        p_estado: 'procesado',
        p_enviados: 0,
        p_desactivados: 0,
        p_ultimo_error: null,
      });

      return respuesta({
        success: true,
        enviados: 0,
        motivo: 'Tipo de notificación fuera del alcance push',
      });
    }

    if (!notificacion.usuario_id) {
      await supabase.rpc('finalizar_push_entrega', {
        p_notification_id: notificationId,
        p_estado: 'procesado',
        p_enviados: 0,
        p_desactivados: 0,
        p_ultimo_error: null,
      });

      return respuesta({
        success: true,
        enviados: 0,
        motivo: 'Sin destinatario',
      });
    }

    const { data: suscripciones, error: suscripcionesError } =
      await supabase
        .from('push_subscriptions')
        .select('id,endpoint,p256dh,auth')
        .eq('usuario_id', notificacion.usuario_id)
        .eq('activo', true);

    if (suscripcionesError) throw suscripcionesError;

    if (!suscripciones?.length) {
      await supabase.rpc('finalizar_push_entrega', {
        p_notification_id: notificationId,
        p_estado: 'procesado',
        p_enviados: 0,
        p_desactivados: 0,
        p_ultimo_error: null,
      });

      return respuesta({
        success: true,
        enviados: 0,
        motivo: 'El usuario no tiene suscripciones activas',
      });
    }

    const payload = JSON.stringify(obtenerPayloadNotificacion(notificacion));

    let enviados = 0;
    let desactivados = 0;
    const errores: string[] = [];

    for (const suscripcion of suscripciones) {
      const host = obtenerHost(suscripcion.endpoint);

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
        const statusCode = obtenerStatusCode(error);
        const mensaje = obtenerMensajeError(error);

        console.error('El Barrio Web Push:', {
          subscription_id: suscripcion.id,
          host,
          status_code: statusCode || null,
          message: mensaje || null,
        });

        if (statusCode === 404 || statusCode === 410) {
          const { error: updateError } = await supabase
            .from('push_subscriptions')
            .update({
              activo: false,
              updated_at: new Date().toISOString(),
            })
            .eq('id', suscripcion.id);

          if (updateError) {
            console.error(
              'No se pudo desactivar suscripción:',
              updateError,
            );
          } else {
            desactivados++;
          }
        } else {
          errores.push(
            `${suscripcion.id} [${host}] HTTP ${statusCode || 'desconocido'}: ${mensaje || 'sin detalle'}`,
          );
        }
      }
    }

    const estado = errores.length > 0 ? 'fallido' : 'procesado';

    const ultimoError = errores.length
      ? errores.join(' | ').slice(0, 4000)
      : null;

    const { error: finalizarError } = await supabase.rpc(
      'finalizar_push_entrega',
      {
        p_notification_id: notificationId,
        p_estado: estado,
        p_enviados: enviados,
        p_desactivados: desactivados,
        p_ultimo_error: ultimoError,
      },
    );

    if (finalizarError) {
      console.error('No se pudo finalizar push_entrega:', finalizarError);
    }

    return respuesta({
      success: estado === 'procesado',
      notification_id: notificationId,
      destinatario: notificacion.usuario_id,
      enviados,
      desactivados,
      errores,
    });
  } catch (error: any) {
    console.error('send-push error:', error);

    try {
      await supabase.rpc('finalizar_push_entrega', {
        p_notification_id: notificationId,
        p_estado: 'fallido',
        p_enviados: 0,
        p_desactivados: 0,
        p_ultimo_error: String(error?.message || 'Error interno').slice(0, 4000),
      });
    } catch (finalizarError) {
      console.error(
        'No se pudo registrar fallo de push_entrega:',
        finalizarError,
      );
    }

    return respuesta(
      {
        success: false,
        error: error?.message || 'Error interno enviando notificación push',
      },
      500,
    );
  }
});
