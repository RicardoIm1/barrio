import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as webpushModule from 'npm:web-push@3.6.7';

// web-push es CommonJS: consumir el namespace evita asumir una exportación default.
const webpush: any = (webpushModule as any).default ?? webpushModule;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Secreto independiente para autorizar al webhook.
// NO es la Service Role Key.
const SEND_PUSH_KEY = Deno.env.get('elbarrio_send_push_key') ?? '';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT =
  Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@elbarrio.me';


// ============================================================
// HUELLA DE DIAGNÓSTICO
// No revela la clave privada.
// ============================================================

async function huellaSHA256(valor: string): Promise<string> {
  const datos = new TextEncoder().encode(valor);
  const hash = await crypto.subtle.digest('SHA-256', datos);

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

console.log('VAPID diagnóstico:', {
  public_key_configurada: Boolean(VAPID_PUBLIC_KEY),
  private_key_configurada: Boolean(VAPID_PRIVATE_KEY),
  subject_configurado: Boolean(VAPID_SUBJECT),
  public_key_fingerprint: await huellaSHA256(VAPID_PUBLIC_KEY),
});


// ============================================================
// CORS
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};


// ============================================================
// RESPUESTAS
// ============================================================

function respuesta(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}


// ============================================================
// VALIDACIÓN DE CONFIGURACIÓN
// ============================================================

function validarConfiguracion() {
  const faltantes: string[] = [];

  if (!SUPABASE_URL) {
    faltantes.push('SUPABASE_URL');
  }

  if (!SERVICE_ROLE_KEY) {
    faltantes.push('SUPABASE_SERVICE_ROLE_KEY');
  }

  if (!SEND_PUSH_KEY) {
    faltantes.push('elbarrio_send_push_key');
  }

  if (!VAPID_PUBLIC_KEY) {
    faltantes.push('VAPID_PUBLIC_KEY');
  }

  if (!VAPID_PRIVATE_KEY) {
    faltantes.push('VAPID_PRIVATE_KEY');
  }

  return faltantes;
}


// ============================================================
// AUTORIZACIÓN DEL WEBHOOK
//
// IMPORTANTE:
// La Service Role Key NO se utiliza para autorizar la llamada.
//
// El webhook debe enviar el secreto:
// elbarrio_send_push_key
//
// Puede llegar como:
//   apikey: <secreto>
// o:
//   Authorization: Bearer <secreto>
// ============================================================

function autorizado(req: Request) {
  const apiKey = req.headers.get('apikey') || '';
  const authorization = req.headers.get('authorization') || '';

  return (
    apiKey === SEND_PUSH_KEY ||
    authorization === `Bearer ${SEND_PUSH_KEY}`
  );
}


// ============================================================
// CONSTRUCCIÓN DEL PAYLOAD
// ============================================================

function obtenerPayloadNotificacion(notificacion: any) {
  const tipo = notificacion.tipo;

  const tituloPorTipo: Record<string, string> = {
    like: 'A alguien le gustó tu aviso',
    dislike: 'Alguien marcó tu aviso como no recomendado',
    comentario: 'Nuevo comentario en tu aviso',
    mensaje_privado: 'Tienes un mensaje nuevo en El Barrio',
  };

  const esMensajePrivado = tipo === 'mensaje_privado';

  return {
    titulo: tituloPorTipo[tipo] || 'El Barrio',

    // Los mensajes privados nunca exponen contenido ni identidad en la pantalla bloqueada.
    descripcion: esMensajePrivado
      ? 'Tienes un mensaje nuevo en El Barrio'
      : (notificacion.mensaje || tituloPorTipo[tipo] || 'Tienes una nueva notificación'),

    url: esMensajePrivado && notificacion.remitente_id
      ? `/admin.html?mensaje=${encodeURIComponent(notificacion.remitente_id)}`
      : (notificacion.aviso_id
        ? `/aviso.html?id=${encodeURIComponent(notificacion.aviso_id)}`
        : '/index.html'),

    aviso_id: notificacion.aviso_id || null,

    id: notificacion.id,

    tipo,

    tag: `el-barrio-${tipo}-${notificacion.aviso_id || notificacion.id}`,

    icono: '/icons/logo-elbarrio.png',

    badge: '/icons/logo-elbarrio.png',
  };
}


// ============================================================
// FUNCIÓN PRINCIPAL
// ============================================================

Deno.serve(async (req: Request) => {

  // ----------------------------------------------------------
  // OPTIONS / CORS
  // ----------------------------------------------------------

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }


  // ----------------------------------------------------------
  // SOLO POST
  // ----------------------------------------------------------

  if (req.method !== 'POST') {
    return respuesta(
      {
        success: false,
        error: 'Método no permitido',
      },
      405,
    );
  }


  // ----------------------------------------------------------
  // CONFIGURACIÓN
  // ----------------------------------------------------------

  const faltantes = validarConfiguracion();

  if (faltantes.length) {
    console.error('Configuración incompleta:', faltantes);

    return respuesta(
      {
        success: false,
        error: 'Configuración incompleta de Web Push',
      },
      500,
    );
  }


  // ----------------------------------------------------------
  // AUTORIZACIÓN
  // ----------------------------------------------------------

  if (!autorizado(req)) {
    console.warn('Intento de acceso no autorizado a send-push');

    return respuesta(
      {
        success: false,
        error: 'No autorizado',
      },
      401,
    );
  }


  // ----------------------------------------------------------
  // LEER JSON
  // ----------------------------------------------------------

  let body: any;

  try {
    body = await req.json();
  } catch (_) {
    return respuesta(
      {
        success: false,
        error: 'JSON inválido',
      },
      400,
    );
  }


  // ----------------------------------------------------------
  // OBTENER ID DE LA NOTIFICACIÓN
  // ----------------------------------------------------------

  const notificationId =
    body?.notification_id ||
    body?.record?.id ||
    body?.id;

  const privateMessageId = body?.private_message_id || null;

  if (!notificationId && !privateMessageId) {
    return respuesta(
      {
        success: false,
        error: 'Falta notification_id o private_message_id',
      },
      400,
    );
  }


  // ==========================================================
  // CLIENTE SUPABASE PRIVILEGIADO
  //
  // La Service Role Key se utiliza únicamente aquí,
  // dentro de la función.
  //
  // Nunca debe aparecer en el frontend.
  // ==========================================================

  const supabase = createClient(
    SUPABASE_URL,
    SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );


  try {

    // --------------------------------------------------------
    // CONFIGURAR WEB PUSH
    // --------------------------------------------------------

    webpush.setVapidDetails(
      VAPID_SUBJECT,
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY,
    );


    // --------------------------------------------------------
    // OBTENER NOTIFICACIÓN
    // --------------------------------------------------------

    let notificacion: any = null;

    if (privateMessageId) {
      const {
        data: mensajePrivado,
        error: mensajePrivadoError,
      } = await supabase
        .from('mensajes_privados')
        .select('id,remitente_id,destinatario_id')
        .eq('id', privateMessageId)
        .maybeSingle();

      if (mensajePrivadoError) throw mensajePrivadoError;

      if (!mensajePrivado) {
        return respuesta({ success: false, error: 'Mensaje privado no encontrado' }, 404);
      }

      notificacion = {
        id: mensajePrivado.id,
        usuario_id: mensajePrivado.destinatario_id,
        remitente_id: mensajePrivado.remitente_id,
        tipo: 'mensaje_privado',
        mensaje: 'Tienes un mensaje nuevo en El Barrio',
        aviso_id: null,
      };
    } else {
      const {
        data,
        error: notificacionError,
      } = await supabase
        .from('notificaciones')
        .select('id,usuario_id,tipo,mensaje,aviso_id,leida,fecha')
        .eq('id', notificationId)
        .maybeSingle();

      if (notificacionError) throw notificacionError;

      if (!data) {
        return respuesta(
          { success: false, error: 'Notificación no encontrada' },
          404,
        );
      }

      notificacion = data;
    }


    // --------------------------------------------------------
    // TIPOS QUE GENERAN PUSH
    // --------------------------------------------------------

    if (
      ![
        'like',
        'dislike',
        'comentario',
        'mensaje_privado',
      ].includes(notificacion.tipo)
    ) {
      return respuesta({
        success: true,
        enviados: 0,
        motivo:
          'Tipo de notificación fuera del alcance push',
      });
    }


    // --------------------------------------------------------
    // VALIDAR DESTINATARIO
    // --------------------------------------------------------

    if (!notificacion.usuario_id) {
      return respuesta({
        success: true,
        enviados: 0,
        motivo: 'Sin destinatario',
      });
    }


    // --------------------------------------------------------
    // OBTENER SUSCRIPCIONES ACTIVAS
    // --------------------------------------------------------

    const {
      data: suscripciones,
      error: suscripcionesError,
    } = await supabase
      .from('push_subscriptions')
      .select(
        'id,endpoint,p256dh,auth',
      )
      .eq(
        'usuario_id',
        notificacion.usuario_id,
      )
      .eq(
        'activo',
        true,
      );


    if (suscripcionesError) {
      throw suscripcionesError;
    }


    if (!suscripciones?.length) {
      return respuesta({
        success: true,
        enviados: 0,
        motivo:
          'El usuario no tiene suscripciones activas',
      });
    }


    // --------------------------------------------------------
    // PREPARAR PAYLOAD
    // --------------------------------------------------------

    const payload = JSON.stringify(
      obtenerPayloadNotificacion(
        notificacion,
      ),
    );


    let enviados = 0;
    let desactivados = 0;

    const errores: string[] = [];


    // ========================================================
    // ENVIAR A CADA SUSCRIPCIÓN
    // ========================================================

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

        const statusCode = Number(
          error?.statusCode ||
          error?.status ||
          0,
        );


        // ----------------------------------------------------
        // SUSCRIPCIÓN CADUCADA
        // ----------------------------------------------------

        if (
          statusCode === 404 ||
          statusCode === 410
        ) {

          const {
            error: updateError,
          } = await supabase
            .from('push_subscriptions')
            .update({
              activo: false,
              updated_at:
                new Date().toISOString(),
            })
            .eq(
              'id',
              suscripcion.id,
            );


          if (updateError) {

            console.error(
              'No se pudo desactivar suscripción:',
              updateError,
            );

          } else {

            desactivados++;
          }


        } else {

          // --------------------------------------------------
          // ERROR DE ENVÍO
          // --------------------------------------------------

          console.error(
            'Error enviando Web Push:',
            error,
          );

          errores.push(
            `subscription:${suscripcion.id}:${statusCode || 'unknown'}`,
          );
        }
      }
    }


    // --------------------------------------------------------
    // RESULTADO
    // --------------------------------------------------------

    return respuesta({
      success: true,

      notificacion_id:
        notificationId || privateMessageId,

      destinatario:
        notificacion.usuario_id,

      enviados,

      desactivados,

      errores,
    });


  } catch (error: any) {

    console.error(
      'send-push error:',
      error,
    );


    return respuesta(
      {
        success: false,
        error:
          error?.message ||
          'Error interno enviando notificación push',
      },
      500,
    );
  }
});