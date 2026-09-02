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

async function supabaseAvisosList({ soloMios = false, filtros = {}, paginacion = null } = {}) {
  const client = await getSupabaseClient();
  const usuario = getUsuarioLocal();
  if (!usuario?.id) throw new Error('Sesión de usuario no disponible');

  let query = client
    .from('avisos')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (soloMios) query = query.eq('created_by', usuario.id);

  if (filtros?.categoria && filtros.categoria !== 'todos') {
    query = query.eq('categoria', filtros.categoria);
  }

  if (filtros?.status && filtros.status !== 'todos') {
    query = query.eq('status', filtros.status);
  }

  if (paginacion) {
    const pagina = Math.max(1, Number(paginacion.pagina) || 1);
    const limite = Math.min(1000, Math.max(1, Number(paginacion.limite) || 10));
    const desde = (pagina - 1) * limite;
    query = query.range(desde, desde + limite - 1);
  } else {
    query = query.range(0, 999);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return respuestaOK({ datos: data || [], total: count || 0 });
}

async function supabasePeticion(accion, datos = {}) {
  const client = await getSupabaseClient();
  const usuario = getUsuarioLocal();

  switch (accion) {
    case 'LISTAR_TODOS_AVISOS':
      return await supabaseAvisosList({ soloMios: false, filtros: datos });

    case 'LISTAR_MIS_AVISOS':
      return await supabaseAvisosList({
        soloMios: true,
        filtros: datos,
        paginacion: datos.pagina || datos.limite ? { pagina: datos.pagina || 1, limite: datos.limite || 1000 } : null
      });

    case 'LISTAR': {
      const coleccion = String(datos.coleccion || '').toUpperCase();

      if (coleccion === 'AVISOS') {
        const filtros = { ...datos };
        delete filtros.coleccion;
        delete filtros.pagina;
        delete filtros.limite;

        const esAdmin = usuario?.rol === 'admin';
        return await supabaseAvisosList({
          soloMios: !esAdmin,
          filtros,
          paginacion: {
            pagina: datos.pagina || 1,
            limite: datos.limite || 10
          }
        });
      }

      if (coleccion === 'USUARIOS') {
        const { data, error, count } = await client
          .from('usuarios')
          .select('*', { count: 'exact' })
          .order('fecha_registro', { ascending: false })
          .range(0, Math.min(999, (Number(datos.limite) || 100) - 1));
        if (error) throw error;
        return respuestaOK({ datos: data || [], total: count || 0 });
      }

      throw new Error(`Colección no soportada en Supabase: ${coleccion}`);
    }

    case 'CREAR': {
      const coleccion = String(datos.coleccion || '').toUpperCase();
      const payload = datos.datos || {};

      if (coleccion === 'AVISOS') {
        if (!usuario?.id) throw new Error('Sesión de usuario no disponible');

        const aviso = {
          ...payload,
          created_by: usuario.id,
          destacado: payload.destacado === true || payload.destacado === 'TRUE' || payload.destacado === 'true' || payload.destacado === 1,
          fecha_evento: payload.fecha_evento || null,
          created_at: payload.created_at || new Date().toISOString()
        };

        const { data, error } = await client
          .from('avisos')
          .insert(aviso)
          .select()
          .single();

        if (error) throw error;
        return respuestaOK(data);
      }

      throw new Error(`CREAR no soportado para ${coleccion}`);
    }

    case 'ACTUALIZAR': {
      const coleccion = String(datos.coleccion || '').toUpperCase();
      const id = datos.id;
      if (!id) throw new Error('ID requerido');

      if (coleccion === 'AVISOS') {
        const cambios = { ...(datos.datos || {}), updated_at: new Date().toISOString() };
        if ('destacado' in cambios) {
          cambios.destacado = cambios.destacado === true || cambios.destacado === 'TRUE' || cambios.destacado === 'true' || cambios.destacado === 1;
        }
        if (cambios.fecha_evento === '') cambios.fecha_evento = null;

        const { data, error } = await client
          .from('avisos')
          .update(cambios)
          .eq('id', id)
          .select()
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('No se pudo actualizar el aviso. Revisa permisos RLS.');
        return respuestaOK(data);
      }

      if (coleccion === 'USUARIOS') {
        const { data, error } = await client
          .from('usuarios')
          .update(datos.datos || {})
          .eq('id', id)
          .select()
          .maybeSingle();
        if (error) throw error;
        return respuestaOK(data);
      }

      throw new Error(`ACTUALIZAR no soportado para ${coleccion}`);
    }

    case 'ELIMINAR': {
      const coleccion = String(datos.coleccion || '').toUpperCase();
      if (coleccion !== 'AVISOS') throw new Error(`ELIMINAR no soportado para ${coleccion}`);

      const { data, error } = await client
        .from('avisos')
        .update({ status: 'eliminado', updated_at: new Date().toISOString() })
        .eq('id', datos.id)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('No se pudo eliminar el aviso. Revisa permisos RLS.');
      return respuestaOK(data);
    }

    case 'LISTAR_USUARIOS':
    case 'OBTENER_USUARIOS': {
      const { data, error } = await client
        .from('usuarios')
        .select('*')
        .order('fecha_registro', { ascending: false })
        .range(0, 999);
      if (error) throw error;
      return respuestaOK({ datos: data || [], total: data?.length || 0 });
    }

    case 'ELIMINAR_USUARIO': {
      const { data, error } = await client
        .from('usuarios')
        .update({ activo: false })
        .eq('id', datos.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('No se pudo desactivar el usuario.');
      return respuestaOK(data);
    }

    case 'APROBAR_AVISO':
      return await supabasePeticion('ACTUALIZAR', {
        coleccion: 'AVISOS',
        id: datos.id,
        datos: { status: 'activo' }
      });

    case 'RECHAZAR_AVISO':
      return await supabasePeticion('ACTUALIZAR', {
        coleccion: 'AVISOS',
        id: datos.id,
        datos: { status: 'rechazado' }
      });

    default:
      return null;
  }
}

class API {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  static async peticion(accion, datos = {}, apiKey = null, intentos = 2) {
    const accionSupabase = [
      'LISTAR_TODOS_AVISOS', 'LISTAR_MIS_AVISOS', 'LISTAR', 'CREAR',
      'ACTUALIZAR', 'ELIMINAR', 'LISTAR_USUARIOS', 'OBTENER_USUARIOS',
      'ELIMINAR_USUARIO', 'APROBAR_AVISO', 'RECHAZAR_AVISO'
    ].includes(accion);

    if (accionSupabase) {
      try {
        const resultado = await supabasePeticion(accion, datos);
        if (resultado) return resultado;
      } catch (error) {
        console.error(`❌ Supabase ${accion}:`, error);
        throw error;
      }
    }

    // Compatibilidad temporal con GAS para funciones aún no migradas.
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams();
      params.append('accion', accion);
      if (apiKey) params.append('api_key', apiKey);
      Object.entries(datos).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
        }
      });

      const callbackName = 'callback_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
      const url = `${API_BASE_URL}?callback=${callbackName}&${params.toString()}`;
      const timeout = setTimeout(() => {
        delete window[callbackName];
        if (intentos > 0) {
          API.peticion(accion, datos, apiKey, intentos - 1).then(resolve).catch(reject);
        } else {
          reject(new Error('Timeout de conexión'));
        }
      }, 30000);

      window[callbackName] = response => {
        clearTimeout(timeout);
        delete window[callbackName];
        resolve(response);
      };

      const script = document.createElement('script');
      script.src = url;
      script.onerror = () => {
        clearTimeout(timeout);
        delete window[callbackName];
        if (intentos > 0) API.peticion(accion, datos, apiKey, intentos - 1).then(resolve).catch(reject);
        else reject(new Error('Error de conexión con el servidor'));
      };
      document.body.appendChild(script);
    });
  }

  static async request(accion, datos = {}, apiKey = null) {
    if (['LISTAR_USUARIOS', 'OBTENER_USUARIOS'].includes(accion)) {
      return await API.peticion(accion, datos, apiKey);
    }
    return await API.peticion(accion, datos, apiKey);
  }

  static async post(accion, datos = {}, apiKey = null) {
    return await API.peticion(accion, datos, apiKey);
  }

  static async login(email, password) {
    if (window.Auth?.login) return await Auth.login(email, password);
    throw new Error('Auth no disponible');
  }

  static async registro(datos) {
    throw new Error('El registro debe realizarse mediante Supabase Auth.');
  }

  static async logout() {
    if (window.Auth?.logout) {
      await Auth.logout();
      return;
    }
    localStorage.removeItem('usuario');
    localStorage.removeItem('api_key');
  }

  static getUsuarioActual() {
    return getUsuarioLocal();
  }

  static isLoggedIn() {
    return !!getUsuarioLocal();
  }

  static async listar(coleccion, filtros = {}, paginacion = {}) {
    const resultado = await API.peticion('LISTAR', {
      coleccion,
      ...filtros,
      ...paginacion
    });
    if (resultado?.success) return resultado.data || { datos: [], total: 0 };
    return resultado || { datos: [], total: 0 };
  }

  static async crearAviso(datos, apiKey = null) {
    return await API.peticion('CREAR', { coleccion: 'AVISOS', datos }, apiKey);
  }

  static async actualizarAviso(id, datos, apiKey = null) {
    return await API.peticion('ACTUALIZAR', { coleccion: 'AVISOS', id, datos }, apiKey);
  }

  static async eliminar(coleccion, id, apiKey = null) {
    return await API.peticion('ELIMINAR', { coleccion, id }, apiKey);
  }

  static async aprobarAviso(id, apiKey = null) {
    return await API.peticion('APROBAR_AVISO', { id }, apiKey);
  }

  static async rechazarAviso(id, apiKey = null) {
    return await API.peticion('RECHAZAR_AVISO', { id }, apiKey);
  }

  static async listarUsuarios(apiKey = null) {
    return await API.peticion('LISTAR_USUARIOS', {}, apiKey);
  }

  static async actualizarUsuario(id, datos, apiKey = null) {
    return await API.peticion('ACTUALIZAR', { coleccion: 'USUARIOS', id, datos }, apiKey);
  }

  // Funciones aún no migradas. Se conservan para no romper páginas antiguas.
  static async registrarVista(id) { return await API.peticion('REGISTRAR_VISTA', { id }); }
  static async registrarClickWhatsApp(id) { return await API.peticion('REGISTRAR_CLICK_WHATSAPP', { id }); }
  static async registrarInteres(id) { return await API.peticion('REGISTRAR_INTERES', { id }); }
  static async listarComentarios(avisoId) { const r = await API.peticion('LISTAR_COMENTARIOS', { avisoId }); return r?.data || []; }
  static async agregarComentario(avisoId, texto, autor) { return await API.peticion('AGREGAR_COMENTARIO', { avisoId, texto, autor }); }
  static async miReputacion(apiKey) { return await API.peticion('MI_REPUTACION', {}, apiKey); }
  static async solicitarVerificacionTelefono(telefono, apiKey) { return await API.peticion('VERIFICAR_TELEFONO_SOLICITAR', { telefono }, apiKey); }
  static async confirmarVerificacionTelefono(codigo, apiKey) { return await API.peticion('VERIFICAR_TELEFONO_CONFIRMAR', { codigo }, apiKey); }
  static async votarAviso(avisoId, tipo, apiKey) { return await API.peticion('VOTAR_AVISO', { aviso_id: avisoId, tipo }, apiKey); }
  static async reportarAviso(avisoId, motivo, apiKey) { return await API.peticion('REPORTAR_AVISO', { aviso_id: avisoId, motivo }, apiKey); }

  static mostrarExito(mensaje) {
    const container = document.getElementById('mensaje-container');
    if (container) {
      container.innerHTML = `<div class="mensaje mensaje-exito" style="background:#d4edda;color:#155724;padding:12px;border-radius:8px;margin-bottom:16px;">${escapeHtmlGlobal(mensaje)}</div>`;
      setTimeout(() => { if (container) container.innerHTML = ''; }, 4000);
    } else {
      alert(mensaje);
    }
  }

  static mostrarError(mensaje) {
    const container = document.getElementById('mensaje-container');
    if (container) {
      container.innerHTML = `<div class="mensaje mensaje-error" style="background:#f8d7da;color:#721c24;padding:12px;border-radius:8px;margin-bottom:16px;">${escapeHtmlGlobal(mensaje)}</div>`;
    } else {
      alert(mensaje);
    }
  }
}

function escapeHtmlGlobal(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

window.API = API;
window.llamarAPI = (accion, datos = {}, apiKey = null) => API.peticion(accion, datos, apiKey);

window.dispatchEvent(new CustomEvent('api-ready'));
console.log('📡 API Client cargado. Supabase activo para administración.');