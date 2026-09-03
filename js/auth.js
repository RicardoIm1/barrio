console.log('🔵 auth.js cargando...');

const EL_BARRIO_SUPABASE_URL = 'https://gnjaumpjerbbwlkcgxqa.supabase.co';
const EL_BARRIO_SUPABASE_KEY = 'sb_publishable_x01F_xzyh5b-sZdwhKh6FQ_OzQVxMpN';

async function obtenerSupabaseClient() {
  if (typeof supabaseClient !== 'undefined' && supabaseClient) return supabaseClient;

  if (window.__elBarrioSupabaseClient) {
    return window.__elBarrioSupabaseClient;
  }

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
    EL_BARRIO_SUPABASE_URL,
    EL_BARRIO_SUPABASE_KEY
  );

  console.log('✅ Cliente Supabase creado desde auth.js');
  return window.__elBarrioSupabaseClient;
}

async function construirUsuario(client, user) {
  let perfil = null;

  try {
    const { data, error } = await client
      .from('usuarios')
      .select('id,email,nombre,rol,activo')
      .eq('id', user.id)
      .maybeSingle();

    if (!error) perfil = data;
    else console.warn('⚠️ No se pudo consultar perfil usuarios:', error.message);
  } catch (e) {
    console.warn('⚠️ Error consultando perfil usuarios:', e.message);
  }

  return {
    id: user.id,
    email: perfil?.email || user.email,
    nombre: perfil?.nombre || user.user_metadata?.nombre || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario',
    rol: perfil?.rol || user.user_metadata?.rol || user.app_metadata?.rol || 'usuario',
    activo: perfil?.activo !== false
  };
}

function guardarCompatibilidad(usuario, session) {
  localStorage.setItem('usuario', JSON.stringify(usuario));
  if (session?.access_token) localStorage.setItem('api_key', session.access_token);
}

const Auth = {
  async login(email, password) {
    const client = await obtenerSupabaseClient();

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    if (data.user) {
      const usuario = await construirUsuario(client, data.user);
      guardarCompatibilidad(usuario, data.session);
      console.log('🟢 Sesión Supabase reconocida:', usuario);
    }

    return data;
  },

  async requireAuth() {
    const client = await obtenerSupabaseClient();
    const { data, error } = await client.auth.getSession();

    if (error) {
      console.error('❌ Error comprobando sesión:', error);
      return null;
    }

    const session = data?.session;
    if (!session?.user) {
      console.warn('🔒 No existe sesión Supabase activa');
      return null;
    }

    const usuario = await construirUsuario(client, session.user);
    guardarCompatibilidad(usuario, session);
    return usuario;
  },

  async logout() {
    const client = await obtenerSupabaseClient();
    const { error } = await client.auth.signOut();

    if (error) {
      console.error('❌ Error cerrando sesión:', error);
      throw error;
    }

    localStorage.removeItem('usuario');
    localStorage.removeItem('api_key');
    console.log('🔓 Sesión Supabase cerrada');
  }
};

window.Auth = Auth;
window.obtenerSupabaseClient = obtenerSupabaseClient;

// ==================== COMPATIBILIDAD API ====================
// api.js conserva API.peticion() como núcleo. Estos puentes mantienen
// compatibilidad con index.html y app.js sin duplicar lógica.

if (typeof API !== 'undefined') {
  API.listarPublicos = async function (filtros = {}, paginacion = {}) {
    return await API.peticion(
      'LISTAR_AVISOS_PUBLICOS',
      { ...(filtros || {}), ...(paginacion || {}) }
    );
  };

  API.listar = async function (coleccion, filtros = {}, paginacion = {}) {
    const nombre = String(coleccion || '').toUpperCase();

    if (nombre === 'AVISOS') {
      return await API.listarPublicos(filtros, paginacion);
    }

    return await API.peticion('LISTAR', {
      coleccion: nombre,
      ...(filtros || {}),
      ...(paginacion || {})
    });
  };

  console.log('✅ Compatibilidad API.listar/listarPublicos restaurada');
}
