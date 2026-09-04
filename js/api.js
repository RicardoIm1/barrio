// ==================== API CLIENT ====================
// El Barrio usa exclusivamente Supabase.
// No existe fallback ni dependencia de Google Apps Script.

(function limpiarSesionCorrupta() {
  const usuarioStr = localStorage.getItem('usuario');
  if (usuarioStr && !usuarioStr.trim().startsWith('{') && !usuarioStr.trim().startsWith('[')) {
    localStorage.removeItem('usuario');
    localStorage.removeItem('api_key');
  }
})();

const API_SUPABASE_URL = 'https://gnjaumpjerbbwlkcgxqa.supabase.co';
const API_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_x01F_xzyh5b-sZdwhKh6FQ_OzQVxMpN';

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
  if (window.__elBarrioSupabaseClient) return window.__elBarrioSupabaseClient;
  if (typeof supabaseClient !== 'undefined' && supabaseClient) return supabaseClient;

  if (!window.supabase) {
    if (!window.__elBarrioSupabaseLoadPromise) {
      window.__elBarrioSupabaseLoadPromise = new Promise((resolve, reject) => {
        const existente = document.querySelector('script[data-el-barrio-supabase-sdk="1"]');
        if (existente) {
          existente.addEventListener('load', resolve, { once: true });
          existente.addEventListener('error', () => reject(new Error('No se pudo cargar Supabase JS')), { once: true });
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.async = true;
        script.dataset.elBarrioSupabaseSdk = '1';
        script.onload = resolve;
        script.onerror = () => reject(new Error('No se pudo cargar Supabase JS'));
        document.head.appendChild(script);
      });
    }
    await window.__elBarrioSupabaseLoadPromise;
  }

  if (!window.supabase) throw new Error('Supabase JS no disponible');
  window.__elBarrioSupabaseClient = window.supabase.createClient(
    API_SUPABASE_URL,
    API_SUPABASE_PUBLISHABLE_KEY
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
    .select(`*, usuarios!avisos_created_by_fkey (nombre)`, { count: 'exact' })
    .order('created_at', { ascending: false });

  if (soloMios) query = query.eq('created_by', usuario.id);
  if (filtros?.categoria && filtros.categoria !== 'todos') query = query.eq('categoria', filtros.categoria);
  if (filtros?.status && filtros.status !== 'todos') query = query.eq('status', filtros.status);

  if (paginacion) {
    const pagina = Math.max(1, Number(paginacion.pagina) || 1);
    const limite = Math.min(1000, Math.max(1, Number(paginacion.limite) || 50));
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

      let positivos = 0, negativos = 0;
      try {
        const { data: votosData, error: votosError } = await client.rpc('obtener_votos_aviso', { p_aviso_id: id });
        if (votosError) throw votosError;
        const votos = typeof votosData === 'string' ? JSON.parse(votosData) : (votosData || {});
        positivos = Number(votos.positivos || 0);
        negativos = Number(votos.negativos || 0);
      } catch (errorVotos) {
        console.warn('No se pudieron cargar los acumulados de votos:', errorVotos);
      }

      return respuestaOK({ ...normalizarAviso(data), likes: positivos, dislikes: negativos, votos_positivos: positivos, votos_negativos: negativos });
    }

    case 'REGISTRAR_VISTA': {
      const id = String(datos?.id || '').trim();
      if (!id) throw new Error('ID de aviso no proporcionado');
      const { data, error } = await client.rpc('registrar_vista_aviso', { p_aviso_id: id });
      if (error) throw error;
      const resultado = typeof data === 'string' ? JSON.parse(data) : (data || {});
      if (!resultado.success) throw new Error(resultado.error || 'No se pudo registrar la vista');
      return respuestaOK(resultado, { vistas: Number(resultado.vistas || 0) });
    }

    case 'LISTAR_AVISOS_PUBLICOS': {
      let query = client
        .from('avisos')
        .select(`*, usuarios!avisos_created_by_fkey (nombre)`, { count: 'exact' })
        .eq('status', 'activo')
        .order('created_at', { ascending: false });
      if (datos?.categoria && datos.categoria !== 'todos') query = query.eq('categoria', datos.categoria);
      const pagina = Math.max(1, Number(datos?.pagina) || 1);
      const limite = Math.min(1000, Math.max(1, Number(datos?.limite) || 200));
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
      throw new Error(`Colección no soportada: ${coleccion}`);
    }

    case 'CREAR': {
      const coleccion = String(datos.coleccion || '').toUpperCase();
      if (coleccion !== 'AVISOS') throw new Error(`Colección no soportada: ${coleccion}`);
      if (!usuario?.id) throw new Error('Sesión de usuario no disponible');
      const payload = { ...(datos.datos || {}), created_by: usuario.id };
      const { data, error } = await client.from('avisos').insert(payload).select().single();
      if (error) throw error;
      return respuestaOK(data);
    }

    case 'ACTUALIZAR': {
      const coleccion = String(datos.coleccion || '').toUpperCase();
      const tabla = coleccion === 'AVISOS' ? 'avisos' : coleccion === 'USUARIOS' ? 'usuarios' : null;
      if (!tabla) throw new Error(`Colección no soportada: ${coleccion}`);
      const { data, error } = await client.from(tabla).update(datos.datos || {}).eq('id', datos.id).select().single();
      if (error) throw error;
      return respuestaOK(data);
    }

    case 'ELIMINAR': {
      const coleccion = String(datos.coleccion || '').toUpperCase();
      const tabla = coleccion === 'AVISOS' ? 'avisos' : coleccion === 'USUARIOS' ? 'usuarios' : null;
      const id = String(datos?.id || '').trim();
      if (!tabla) throw new Error(`Colección no soportada: ${coleccion}`);
      if (!id) throw new Error('ID de registro no proporcionado');

      if (tabla === 'avisos') {
        const { data, error } = await client.from('avisos').update({ status: 'eliminado' }).eq('id', id).select('id,status').single();
        if (error) throw error;
        if (!data || data.status !== 'eliminado') throw new Error('El aviso no fue eliminado. Supabase no permitió la operación o el registro no existe.');
        return respuestaOK(data);
      }

      const { data, error } = await client.from(tabla).delete().eq('id', id).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('El registro no fue eliminado. Supabase no permitió la operación o el registro no existe.');
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
      if (!data?.length) throw new Error('El usuario no fue eliminado. Supabase no permitió la operación o el registro no existe.');
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

    case 'OBTENER_MIS_VOTOS': {
      if (!usuario?.id) return respuestaOK([]);
      const { data, error } = await client
        .from('votos')
        .select('aviso_id,tipo')
        .eq('usuario_id', usuario.id);
      if (error) throw error;
      return respuestaOK(data || []);
    }

    case 'VOTAR_AVISO': {
      const avisoId = String(datos?.aviso_id || '').trim();
      const entrada = String(datos?.tipo || '').trim().toLowerCase();
      const tipo = entrada === 'like' ? 'positivo' : entrada === 'dislike' ? 'negativo' : entrada;
      if (!avisoId) throw new Error('ID de aviso no proporcionado');
      if (!['positivo', 'negativo'].includes(tipo)) throw new Error('Tipo de voto no válido');
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData?.session?.user?.id) throw new Error('Debes iniciar sesión para votar');
      const { data, error } = await client.rpc('votar_aviso', { p_aviso_id: avisoId, p_tipo: tipo });
      if (error) throw error;
      const resultado = typeof data === 'string' ? JSON.parse(data) : (data || {});
      return respuestaOK(resultado, { tipo: resultado.tipo ?? null, likes: Number(resultado.positivos || 0), dislikes: Number(resultado.negativos || 0) });
    }

    case 'ESTADISTICAS_AVANZADAS': {
      const { data: usuarios, error: errorUsuarios } = await client.from('usuarios').select('id, fecha_registro, ultimo_acceso').order('fecha_registro', { ascending: true }).range(0, 999);
      if (errorUsuarios) throw errorUsuarios;
      const { data: avisos, error: errorAvisos } = await client.from('avisos').select('id, created_at, status').order('created_at', { ascending: true }).range(0, 999);
      if (errorAvisos) throw errorAvisos;
      const hoy = new Date();
      const claveDia = valor => { const d = new Date(valor); return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10); };
      const labels = [], usuariosPorDia = [], avisosPorDia = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(hoy); d.setDate(d.getDate() - i);
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
      throw new Error(`Acción no soportada por Supabase: ${accion}`);
  }
}

class API {
  static async peticion(accion, datos = {}) {
    try {
      return await supabasePeticion(accion, datos);
    } catch (error) {
      console.error(`Error Supabase en ${accion}:`, error);
      return respuestaError(error);
    }
  }

  static async registro(datos) {
    const client = await getSupabaseClient();
    const email = String(datos?.email || '').trim().toLowerCase();
    const password = String(datos?.password || '');
    if (!email || !password) throw new Error('Correo y contraseña son obligatorios');
    if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');

    const metadata = {
      nombre: String(datos?.nombre || '').trim(),
      telefono: String(datos?.telefono || '').trim(),
      direccion: String(datos?.direccion || '').trim(),
      categorias: String(datos?.categorias || '').trim(),
      rol: 'usuario'
    };

    const { data, error } = await client.auth.signUp({ email, password, options: { data: metadata } });
    if (error) throw error;

    const session = data?.session || null;
    const user = data?.user || null;
    let usuario = null;

    if (user && session) {
      usuario = {
        id: user.id,
        email: user.email,
        nombre: user.user_metadata?.nombre || email.split('@')[0],
        rol: user.user_metadata?.rol || 'usuario',
        activo: true
      };
      try {
        const { data: perfil, error: perfilError } = await client.from('usuarios').select('id,email,nombre,rol,activo').eq('id', user.id).maybeSingle();
        if (!perfilError && perfil) usuario = { ...usuario, ...perfil };
      } catch (_) {}
      localStorage.setItem('usuario', JSON.stringify(usuario));
      if (session.access_token) localStorage.setItem('api_key', session.access_token);
    }

    return {
      success: true,
      data: { user, session, usuario, requiere_confirmacion: !!user && !session, api_key: session?.access_token || null },
      user,
      usuario,
      api_key: session?.access_token || null
    };
  }

  static getUsuarioActual() { return getUsuarioLocal(); }
  static async request(accion, datos = {}) { return await API.peticion(accion, datos); }
  static async registrarVista(id) { return await API.peticion('REGISTRAR_VISTA', { id }); }
  static async registrarClickWhatsApp(id) {
    try {
      const client = await getSupabaseClient();
      const { data, error } = await client.rpc('registrar_click_whatsapp', { p_aviso_id: id });
      if (error) throw error;
      return respuestaOK(data);
    } catch (error) {
      console.warn('No se pudo registrar el click de WhatsApp:', error);
      return respuestaError(error);
    }
  }
  static async votarAviso(avisoId, tipo) { return await API.peticion('VOTAR_AVISO', { aviso_id: avisoId, tipo }); }
}

window.API = API;
window.getSupabaseClient = getSupabaseClient;

API.listarPublicos = async function (filtros = {}, paginacion = {}) {
  const limiteSolicitado = Number(paginacion?.limite) || 1000;
  const limiteSeguro = Math.min(1000, Math.max(1, limiteSolicitado));
  const parametros = { ...(filtros || {}), ...(paginacion || {}), limite: limiteSeguro };
  const resultado = await API.peticion('LISTAR_AVISOS_PUBLICOS', parametros);
  if (resultado?.success && resultado?.data) return { ...resultado, datos: resultado.data.datos || [], total: resultado.data.total ?? (resultado.data.datos || []).length };
  return resultado;
};

API.listar = async function (coleccion, filtros = {}, paginacion = {}) {
  const nombre = String(coleccion || '').toUpperCase();
  const resultado = await API.peticion('LISTAR', { coleccion: nombre, ...(filtros || {}), ...(paginacion || {}) });
  if (resultado?.success && resultado?.data) return { ...resultado, datos: resultado.data.datos || [], total: resultado.data.total ?? (resultado.data.datos || []).length };
  return resultado;
};

// Cargar estadísticas personales como módulo independiente.
// Se activa solo si el usuario actual no es administrador.
(function cargarModuloEstadisticasUsuario() {
  function cargar() {
    if (!document.querySelector('body')) return;
    if (!document.getElementById('estadisticas-usuario') && !localStorage.getItem('usuario')) return;
    if (document.querySelector('script[data-el-barrio-estadisticas-usuario="1"]')) return;
    const script = document.createElement('script');
    script.src = '/js/estadisticas-usuario.js?v=20260904-1';
    script.async = true;
    script.dataset.elBarrioEstadisticasUsuario = '1';
    script.onerror = () => console.warn('No se pudo cargar el módulo de estadísticas personales.');
    document.head.appendChild(script);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cargar, { once: true });
  else cargar();
})();

console.log('✅ API de El Barrio: Supabase exclusivo, sin Google Apps Script');
