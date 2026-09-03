// ==================== API CLIENT ====================
// Supabase es la fuente de datos para el panel de administración.
// Las acciones no migradas conservan compatibilidad temporal con GAS.

(function limpiarSesionCorrupta() {
  const usuarioStr = localStorage.getItem('usuario');
  if (usuarioStr && !usuarioStr.trim().startsWith('{') && !usuarioStr.trim().startsWith('[')) {
    localStorage.removeItem('usuario');
    localStorage.removeItem('api_key');
  }
})();

const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbx0b0ZObDChZ3u8DF2L9QCiBZrpfdbFiBHUYfIEvJjNzu_gh4uB66syAAlwPLGEJDB1/exec';
const SUPABASE_URL = 'https://gnjaumpjerbbwlkcgxqa.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_x01F_xzyh5b-sZdwhKh6FQ_OzQVxMpN';

function getUsuarioLocal() {
  try {
    const raw = localStorage.getItem('usuario');
    if (!raw) return null;
    const usuario = JSON.parse(raw);
    return usuario && typeof usuario === 'object' ? usuario : null;
  } catch (_) {
    localStorage.removeItem('usuario');
    return null;
  }
}

async function getSupabaseClient() {
  if (typeof supabaseClient !== 'undefined' && supabaseClient) return supabaseClient;
  if (window.__elBarrioSupabaseClient) return window.__elBarrioSupabaseClient;

  if (!window.supabase) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = resolve;
      script.onerror = () => reject(new Error('No se pudo cargar Supabase JS'));
      document.head.appendChild(script);
    });
  }

  window.__elBarrioSupabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );

  return window.__elBarrioSupabaseClient;
}

function respuestaOK(data = null, extra = {}) {
  return { success: true, data, ...extra };
}

function respuestaError(error) {
  const message = error?.message || String(error) || 'Error desconocido';
  return { success: false, error: message, details: error?.details || null, code: error?.code || null };
}

function normalizarAviso(aviso) {
  if (!aviso) return aviso;
  return {
    ...aviso,
    nombre_autor: aviso.usuarios?.nombre || aviso.nombre_autor || 'Vecino'
  };
}

function normalizarAvisos(avisos) {
  return (avisos || []).map(normalizarAviso);
}

async function supabaseAvisosList({ soloMios = false, filtros = {}, paginacion = null } = {}) {
  const client = await getSupabaseClient();
  const usuario = getUsuarioLocal();
  if (!usuario?.id) throw new Error('Sesión de usuario no disponible');

  let query = client
    .from('avisos')
    .select(`
      *,
      usuarios!avisos_created_by_fkey (
        nombre
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false });

  if (soloMios) query = query.eq('created_by', usuario.id);
  if (filtros?.categoria && filtros.categoria !== 'todos') query = query.eq('categoria', filtros.categoria);
  if (filtros?.status && filtros.status !== 'todos') query = query.eq('status', filtros.status);

  if (paginacion) {
    const pagina = Math.max(1, Number(paginacion.pagina) || 1);
    const limite = Math.max(1, Number(paginacion.limite) || 50);
    const desde = (pagina - 1) * limite;
    query = query.range(desde, desde + limite - 1);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  const avisos = normalizarAvisos(data);
  return respuestaOK({ datos: avisos, total: count ?? avisos.length });
}

async function supabasePeticion(accion, datos = {}) {
  const client = await getSupabaseClient();
  const usuario = getUsuarioLocal();

  switch (accion) {
    case 'OBTENER_AVISO_POR_ID': {
      const id = String(datos?.id || '').trim();
      if (!id) throw new Error('ID de aviso no proporcionado');

      const { data, error } = await client
        .from('avisos')
        .select(`*, usuarios!avisos_created_by_fkey (nombre)`)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return respuestaOK(null);

      let positivos = 0;
      let negativos = 0;
      try {
        const { data: votosData, error: votosError } = await client.rpc('obtener_votos_aviso', {
          p_aviso_id: id
        });
        if (votosError) throw votosError;
        const votos = typeof votosData === 'string' ? JSON.parse(votosData) : (votosData || {});
        positivos = Number(votos.positivos || 0);
        negativos = Number(votos.negativos || 0);
      } catch (votosError) {
        console.warn('No se pudieron cargar los acumulados de votos:', votosError);
      }

      return respuestaOK({
        ...normalizarAviso(data),
        likes: positivos,
        dislikes: negativos,
        votos_positivos: positivos,
        votos_negativos: negativos
      });
    }

    case 'REGISTRAR_VISTA': {
      const id = String(datos?.id || '').trim();
      if (!id) throw new Error('ID de aviso no proporcionado');

      const { data, error } = await client.rpc('registrar_vista_aviso', {
        p_aviso_id: id
      });
      if (error) throw error;

      const resultado = typeof data === 'string' ? JSON.parse(data) : (data || {});
      if (!resultado.success) throw new Error(resultado.error || 'No se pudo registrar la vista');
      return respuestaOK(resultado, { vistas: Number(resultado.vistas || 0) });
    }

    case 'LISTAR_AVISOS_PUBLICOS': {
      let query = client
        .from('avisos')
        .select(`
          *,
          usuarios!avisos_created_by_fkey (
            nombre
          )
        `, { count: 'exact' })
        .eq('status', 'activo')
        .order('created_at', { ascending: false });

      if (datos?.categoria && datos.categoria !== 'todos') {
        query = query.eq('categoria', datos.categoria);
      }

      const pagina = Math.max(1, Number(datos?.pagina) || 1);
      const limite = Math.max(1, Number(datos?.limite) || 200);
      const desde = (pagina - 1) * limite;
      query = query.range(desde, desde + limite - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      const avisos = normalizarAvisos(data);
      return respuestaOK({ datos: avisos, total: count ?? avisos.length });
    }

    case 'LISTAR_TODOS_AVISOS':
      return await supabaseAvisosList({ filtros: datos, paginacion: datos });

    case 'LISTAR_MIS_AVISOS':
      return await supabaseAvisosList({ soloMios: true, filtros: datos, paginacion: datos });

    case 'LISTAR': {
      const coleccion = String(datos.coleccion || '').toUpperCase();
      if (coleccion === 'AVISOS') return await supabaseAvisosList({ filtros: datos, paginacion: datos });
      if (coleccion === 'USUARIOS') {
        let query = client.from('usuarios').select('*', { count: 'exact' });
        if (datos?.id) query = query.eq('id', datos.id);
        const { data, error, count } = await query;
        if (error) throw error;
        return respuestaOK({ datos: data || [], total: count ?? (data || []).length });
      }
      return null;
    }

    case 'CREAR': {
      const coleccion = String(datos.coleccion || '').toUpperCase();
      if (coleccion === 'AVISOS') {
        if (!usuario?.id) throw new Error('Sesión de usuario no disponible');
        const payload = { ...(datos.datos || {}), created_by: usuario.id };
        const { data, error } = await client.from('avisos').insert(payload).select().single();
        if (error) throw error;
        return respuestaOK(data);
      }
      return null;
    }

    case 'ACTUALIZAR': {
      const coleccion = String(datos.coleccion || '').toUpperCase();
      const tabla = coleccion === 'AVISOS' ? 'avisos' : coleccion === 'USUARIOS' ? 'usuarios' : null;
      if (!tabla) return null;
      const { data, error } = await client.from(tabla).update(datos.datos || {}).eq('id', datos.id).select().single();
      if (error) throw error;
      return respuestaOK(data);
    }

    case 'ELIMINAR': {
      const coleccion = String(datos.coleccion || '').toUpperCase();
      const tabla = coleccion === 'AVISOS' ? 'avisos' : coleccion === 'USUARIOS' ? 'usuarios' : null;
      const id = String(datos?.id || '').trim();
      if (!tabla) return null;
      if (!id) throw new Error('ID de registro no proporcionado');

      if (tabla === 'avisos') {
        const { data, error } = await client
          .from('avisos')
          .update({ status: 'eliminado' })
          .eq('id', id)
          .select('id,status')
          .single();

        if (error) throw error;
        if (!data || data.status !== 'eliminado') {
          throw new Error('El aviso no fue eliminado. Supabase no permitió la operación o el registro no existe.');
        }
        return respuestaOK(data);
      }

      const { data, error } = await client
        .from(tabla)
        .delete()
        .eq('id', id)
        .select('id');

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('El registro no fue eliminado. Supabase no permitió la operación o el registro no existe.');
      }
      return respuestaOK(data[0]);
    }

    case 'LISTAR_USUARIOS':
    case 'OBTENER_USUARIOS': {
      const { data, error, count } = await client.from('usuarios').select('*', { count: 'exact' }).order('fecha_registro', { ascending: false });
      if (error) throw error;
      return respuestaOK({ datos: data || [], total: count ?? (data || []).length });
    }

    case 'ELIMINAR_USUARIO': {
      const id = String(datos?.id || '').trim();
      if (!id) throw new Error('ID de usuario no proporcionado');
      const { data, error } = await client.from('usuarios').delete().eq('id', id).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('El usuario no fue eliminado. Supabase no permitió la operación o el registro no existe.');
      return respuestaOK(data[0]);
    }

    case 'APROBAR_AVISO': {
      const { data, error } = await client.from('avisos').update({ status: 'activo' }).eq('id', datos.id).select().single();
      if (error) throw error;
      return respuestaOK(data);
    }

    case 'RECHAZAR_AVISO': {
      const { data, error } = await client.from('avisos').update({ status: 'rechazado' }).eq('id', datos.id).select().single();
      if (error) throw error;
      return respuestaOK(data);
    }

    case 'VOTAR_AVISO': {
      const avisoId = String(datos?.aviso_id || '').trim();
      const tipoEntrada = String(datos?.tipo || '').trim().toLowerCase();
      const tipo = tipoEntrada === 'like' ? 'positivo' : tipoEntrada === 'dislike' ? 'negativo' : tipoEntrada;
      if (!avisoId) throw new Error('ID de aviso no proporcionado');
      if (!['positivo', 'negativo'].includes(tipo)) throw new Error('Tipo de voto no válido');

      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData?.session?.user?.id) throw new Error('Debes iniciar sesión para votar');

      const { data, error } = await client.rpc('votar_aviso', {
        p_aviso_id: avisoId,
        p_tipo: tipo
      });
      if (error) throw error;

      const resultado = typeof data === 'string' ? JSON.parse(data) : (data || {});
      return respuestaOK(resultado, {
        tipo: resultado.tipo ?? null,
        likes: Number(resultado.positivos || 0),
        dislikes: Number(resultado.negativos || 0)
      });
    }

    case 'ESTADISTICAS_AVANZADAS': {
      const { data: usuarios, error: errorUsuarios } = await client.from('usuarios').select('id, fecha_registro, ultimo_acceso').order('fecha_registro', { ascending: true }).range(0, 999);
      if (errorUsuarios) throw errorUsuarios;
      const { data: avisos, error: errorAvisos } = await client.from('avisos').select('id, created_at, status').order('created_at', { ascending: true }).range(0, 999);
      if (errorAvisos) throw errorAvisos;

      const hoy = new Date();
      const claveDia = valor => {
        const d = new Date(valor);
        return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
      };
      const labels = [], usuariosPorDia = [], avisosPorDia = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(hoy);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        labels.push(key);
        usuariosPorDia.push((usuarios || []).filter(u => claveDia(u.fecha_registro) === key).length);
        avisosPorDia.push((avisos || []).filter(a => claveDia(a.created_at) === key).length);
      }
      const activos = (avisos || []).filter(a => a.status === 'activo').length;
      const pendientes = (avisos || []).filter(a => a.status === 'pendiente').length;
      const promedioUsuarios = usuariosPorDia.length ? (usuariosPorDia.reduce((a, b) => a + b, 0) / usuariosPorDia.length).toFixed(1) : 0;
      const promedioAvisos = avisosPorDia.length ? (avisosPorDia.reduce((a, b) => a + b, 0) / avisosPorDia.length).toFixed(1) : 0;
      return respuestaOK({
        resumen: { promedioDiarioUsuarios: Number(promedioUsuarios), promedioDiarioAvisos: Number(promedioAvisos), totalUsuarios: (usuarios || []).length, totalAvisos: (avisos || []).length, activos, pendientes },
        usuarios: { labels, datos: usuariosPorDia },
        avisos: { labels, datos: avisosPorDia },
        conexiones: { labels, datos: [] },
        enLinea: { total: 0, usuarios: [] }
      });
    }

    default:
      return null;
  }
}

class API {
  constructor() { this.baseUrl = API_BASE_URL; }

  static async peticion(accion, datos = {}, apiKey = null, intentos = 2) {
    const accionSupabase = [
      'OBTENER_AVISO_POR_ID', 'REGISTRAR_VISTA', 'LISTAR_AVISOS_PUBLICOS', 'LISTAR_TODOS_AVISOS', 'LISTAR_MIS_AVISOS', 'LISTAR',
      'CREAR', 'ACTUALIZAR', 'ELIMINAR', 'LISTAR_USUARIOS', 'OBTENER_USUARIOS', 'ELIMINAR_USUARIO',
      'APROBAR_AVISO', 'RECHAZAR_AVISO', 'VOTAR_AVISO', 'ESTADISTICAS_AVANZADAS'
    ];

    if (accionSupabase.includes(accion)) {
      try {
        const resultado = await supabasePeticion(accion, datos);
        if (resultado !== null) return resultado;
      } catch (error) {
        console.error(`Error Supabase en ${accion}:`, error);
        return respuestaError(error);
      }
    }

    const url = new URL(this.baseUrl);
    url.searchParams.set('accion', accion);
    if (apiKey) url.searchParams.set('api_key', apiKey);
    Object.entries(datos || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    });

    try {
      const response = await fetch(url.toString(), { method: 'GET', headers: { Accept: 'application/json' } });
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch (_) { data = null; }
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      return data || { success: true };
    } catch (error) {
      if (intentos > 0) return API.peticion(accion, datos, apiKey, intentos - 1);
      return respuestaError(error);
    }
  }

  static getUsuarioActual() { return getUsuarioLocal(); }
  static async request(accion, datos = {}, apiKey = null) { return await API.peticion(accion, datos, apiKey); }
  static async registrarVista(id) { return await API.peticion('REGISTRAR_VISTA', { id }); }
  static async registrarClickWhatsApp(id) { return await API.peticion('REGISTRAR_CLICK_WHATSAPP', { id }); }
  static async votarAviso(avisoId, tipo, apiKey = null) { return await API.peticion('VOTAR_AVISO', { aviso_id: avisoId, tipo }, apiKey); }
}