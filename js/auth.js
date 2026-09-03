console.log('🔵 auth.js cargando...');

const EL_BARRIO_SUPABASE_URL = 'https://gnjaumpjerbbwlkcgxqa.supabase.co';
const EL_BARRIO_SUPABASE_KEY = 'sb_publishable_x01F_xzyh5b-sZdwhKh6FQ_OzQVxMpN';

let presenciaVisibilityHandler = null;
let presenciaActivityHandler = null;
let moderacionChannel = null;
let moderacionIniciada = false;
let votarAvisoOriginal = null;

async function obtenerSupabaseClient() {
  if (typeof supabaseClient !== 'undefined' && supabaseClient) return supabaseClient;
  if (window.__elBarrioSupabaseClient) return window.__elBarrioSupabaseClient;

  // Un único cargador compartido evita carreras entre api.js y auth.js.
  if (!window.__elBarrioSupabaseLoadPromise && !window.supabase) {
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

  if (!window.supabase) {
    await window.__elBarrioSupabaseLoadPromise;
  }

  if (!window.supabase) throw new Error('Supabase JS no disponible');

  window.__elBarrioSupabaseClient = window.supabase.createClient(EL_BARRIO_SUPABASE_URL, EL_BARRIO_SUPABASE_KEY);
  console.log('✅ Cliente Supabase creado desde auth.js');
  return window.__elBarrioSupabaseClient;
}

function instalarEstilosApagadoTV() {
  if (document.getElementById('el-barrio-apagado-tv-styles')) return;
  const style = document.createElement('style');
  style.id = 'el-barrio-apagado-tv-styles';
  style.textContent = `
    .aviso-apagando-tv {
      pointer-events: none !important;
      transform-origin: center center !important;
      animation: elBarrioApagadoTV .78s cubic-bezier(.55,.05,.68,.19) forwards !important;
    }

    @keyframes elBarrioApagadoTV {
      0% { opacity: 1; transform: scale(1); filter: brightness(1); }
      32% { opacity: 1; transform: scaleY(.075) scaleX(1.015); filter: brightness(1.45); }
      52% { opacity: 1; transform: scaleY(.018) scaleX(.82); filter: brightness(2.4); }
      68% { opacity: .78; transform: scaleY(.009) scaleX(.38); filter: brightness(3.2); }
      100% { opacity: 0; transform: scaleY(0) scaleX(0); filter: brightness(0); }
    }
  `;
  document.head.appendChild(style);
}

function obtenerCardIndicePorId(id) {
  const cards = document.querySelectorAll('.aviso-card');
  const objetivo = String(id);
  for (const card of cards) {
    const dataId = card.getAttribute('data-id');
    if (dataId && String(dataId) === objetivo) return card;
    const onclick = card.getAttribute('onclick') || '';
    if (onclick.includes(objetivo)) return card;
  }
  return null;
}

function eliminarAvisoDelIndice(id) {
  if (typeof todosLosAvisos !== 'undefined' && Array.isArray(todosLosAvisos)) {
    todosLosAvisos = todosLosAvisos.filter(a => String(a.id) !== String(id));
  }
  if (typeof paginaActual !== 'undefined' && typeof totalPaginas !== 'undefined') {
    const cantidad = typeof todosLosAvisos !== 'undefined' && Array.isArray(todosLosAvisos) ? todosLosAvisos.length : 0;
    const paginas = Math.max(1, Math.ceil(cantidad / (typeof AVISOS_POR_PAGINA !== 'undefined' ? AVISOS_POR_PAGINA : 6)));
    if (paginaActual > paginas) paginaActual = paginas;
  }
}

function ejecutarRechazoVisual(id) {
  if (!id) return;
  instalarEstilosApagadoTV();
  const avisoId = String(id);
  const avisoIdActual = typeof AVISO_ID !== 'undefined' ? String(AVISO_ID || '') : '';
  if (avisoIdActual && avisoIdActual === avisoId) {
    const paper = document.querySelector('.aviso-paper');
    if (paper && !paper.classList.contains('aviso-apagando-tv')) {
      paper.classList.add('aviso-apagando-tv');
      setTimeout(() => { window.location.replace('/index.html'); }, 800);
    }
    return;
  }
  const card = obtenerCardIndicePorId(avisoId);
  if (card && !card.classList.contains('aviso-apagando-tv')) {
    card.classList.add('aviso-apagando-tv');
    eliminarAvisoDelIndice(avisoId);
    setTimeout(() => {
      if (card.isConnected) card.remove();
      if (typeof filtrarYAplicarPaginacion === 'function') {
        filtrarYAplicarPaginacion().catch(error => console.warn('Actualización tras rechazo:', error));
      }
    }, 800);
  }
}

function instalarInterceptadorVotos() {
  if (typeof API === 'undefined' || typeof API.votarAviso !== 'function') return false;
  if (API.votarAviso.__elBarrioAutoRechazo) return true;
  votarAvisoOriginal = API.votarAviso.bind(API);
  const votar = async function (id, tipo) {
    const resultado = await votarAvisoOriginal(id, tipo);
    const rechazado = resultado?.rechazado === true || resultado?.status === 'rechazado';
    if (rechazado) ejecutarRechazoVisual(id);
    return resultado;
  };
  votar.__elBarrioAutoRechazo = true;
  API.votarAviso = votar;
  return true;
}

async function iniciarEscuchaModeracion() {
  if (moderacionIniciada) return;
  moderacionIniciada = true;
  instalarEstilosApagadoTV();
  try {
    const client = await obtenerSupabaseClient();
    instalarInterceptadorVotos();
    if (!client?.channel) return;
    moderacionChannel = client.channel('el-barrio-moderacion', { config: { private: false } });
    moderacionChannel
      .on('broadcast', { event: 'aviso_rechazado' }, payload => {
        const id = payload?.payload?.aviso_id || payload?.payload?.id;
        if (id) ejecutarRechazoVisual(id);
      })
      .subscribe((status, error) => {
        if (status === 'SUBSCRIBED') console.log('🟢 Escucha de moderación en tiempo real activa');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('⚠️ Canal de moderación:', status, error || '');
      });
  } catch (error) {
    console.warn('⚠️ No se pudo iniciar escucha de moderación:', error?.message || error);
  }
}

// ============================================================
// PRESENCIA
// La presencia representa el estado de sesión, no la actividad.
// LOGIN  -> fila presente en presencia_usuarios.
// LOGOUT -> fila eliminada de presencia_usuarios.
// No existe vencimiento por tiempo.
// ============================================================
async function registrarPresencia() {
  try {
    const client = await obtenerSupabaseClient();
    const { data, error } = await client.rpc('registrar_presencia');
    if (error) {
      console.warn('⚠️ No se pudo registrar presencia:', error.message);
      return false;
    }
    console.debug('🟢 Login registrado en presencia:', data?.usuario_id || 'usuario autenticado');
    return true;
  } catch (error) {
    console.warn('⚠️ Error registrando presencia:', error?.message || error);
    return false;
  }
}

async function cerrarPresencia() {
  try {
    const client = await obtenerSupabaseClient();
    const { data, error } = await client.rpc('cerrar_presencia');
    if (error) {
      console.warn('⚠️ No se pudo registrar Logout en presencia:', error.message);
      return false;
    }
    console.debug('⚪ Logout registrado en presencia:', data?.usuario_id || 'usuario autenticado');
    return true;
  } catch (error) {
    console.warn('⚠️ Error cerrando presencia:', error?.message || error);
    return false;
  }
}

function detenerPresencia() {
  if (presenciaVisibilityHandler) {
    document.removeEventListener('visibilitychange', presenciaVisibilityHandler);
    presenciaVisibilityHandler = null;
  }
  if (presenciaActivityHandler) {
    ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(evento => document.removeEventListener(evento, presenciaActivityHandler, true));
    presenciaActivityHandler = null;
  }
}

function iniciarPresencia() {
  detenerPresencia();
  registrarPresencia();
}

async function construirUsuario(client, user) {
  let perfil = null;
  try {
    const { data, error } = await client.from('usuarios').select('id,email,nombre,rol,activo').eq('id', user.id).maybeSingle();
    if (!error) perfil = data;
    else console.warn('⚠️ No se pudo consultar perfil usuarios:', error.message);
  } catch (e) { console.warn('⚠️ Error consultando perfil usuarios:', e.message); }
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
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) {
      const usuario = await construirUsuario(client, data.user);
      guardarCompatibilidad(usuario, data.session);
      iniciarPresencia();
      iniciarEscuchaModeracion();
      console.log('🟢 Sesión Supabase reconocida:', usuario);
    }
    return data;
  },
  async requireAuth() {
    const client = await obtenerSupabaseClient();
    const { data, error } = await client.auth.getSession();
    if (error) { console.error('❌ Error comprobando sesión:', error); return null; }
    const session = data?.session;
    if (!session?.user) { detenerPresencia(); return null; }
    const usuario = await construirUsuario(client, session.user);
    guardarCompatibilidad(usuario, session);
    iniciarPresencia();
    iniciarEscuchaModeracion();
    return usuario;
  },
  async logout() {
    const client = await obtenerSupabaseClient();
    await cerrarPresencia();
    detenerPresencia();
    const { error } = await client.auth.signOut();
    if (error) { console.error('❌ Error cerrando sesión:', error); throw error; }
    localStorage.removeItem('usuario');
    localStorage.removeItem('api_key');
    console.log('🔓 Sesión Supabase cerrada');
  }
};

window.Auth = Auth;
window.obtenerSupabaseClient = obtenerSupabaseClient;

if (typeof API !== 'undefined') {
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
    if (nombre === 'AVISOS') return await API.listarPublicos(filtros, paginacion);
    const resultado = await API.peticion('LISTAR', { coleccion: nombre, ...(filtros || {}), ...(paginacion || {}) });
    if (resultado?.success && resultado?.data) return { ...resultado, datos: resultado.data.datos || [], total: resultado.data.total ?? (resultado.data.datos || []).length };
    return resultado;
  };
  console.log('✅ Compatibilidad API.listar/listarPublicos restaurada');
}

// Las funciones de moderación y presencia no deben competir con la carga inicial
// de la página pública en dispositivos móviles.
setTimeout(() => {
  iniciarEscuchaModeracion();
}, 1800);

// ============================================================
// PRESENCIA GLOBAL
// Inicia automáticamente si ya existe una sesión Supabase.
// ============================================================
let presenciaAuthListenerInstalado = false;

async function iniciarPresenciaSiExisteSesion() {
  // En una página pública anónima no necesitamos inicializar Supabase Auth.
  // El login ya registra presencia explícitamente.
  if (!localStorage.getItem('api_key')) return;

  try {
    const client = await obtenerSupabaseClient();
    const { data, error } = await client.auth.getSession();
    if (error) {
      console.warn('⚠️ No se pudo comprobar sesión para presencia:', error.message);
      return;
    }
    if (data?.session?.user) {
      iniciarPresencia();
      console.log('🟢 Presencia global iniciada para sesión existente');
    }

    if (!presenciaAuthListenerInstalado && client.auth?.onAuthStateChange) {
      presenciaAuthListenerInstalado = true;
      client.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          iniciarPresencia();
        } else {
          detenerPresencia();
          setTimeout(() => cerrarPresencia(), 0);
        }
      });
    }
  } catch (error) {
    console.warn('⚠️ No se pudo iniciar presencia global:', error?.message || error);
  }
}

setTimeout(() => {
  iniciarPresenciaSiExisteSesion();
}, 1200);

// ============================================================
// SPLASH NO BLOQUEANTE
// No esperamos a que terminen imágenes, realtime u otras tareas secundarias.
// La aplicación debe quedar visible aunque una dependencia externa tarde.
// ============================================================
function quitarSplashSinEsperarCargaTotal() {
  const splash = document.getElementById('splash-screen');
  if (!splash || splash.dataset.elBarrioOculto === '1') return;
  splash.dataset.elBarrioOculto = '1';
  splash.style.opacity = '0';
  setTimeout(() => {
    if (splash.isConnected) splash.style.display = 'none';
  }, 300);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', quitarSplashSinEsperarCargaTotal, { once: true });
} else {
  quitarSplashSinEsperarCargaTotal();
}

// Seguro adicional para móviles: nunca dejar la pantalla de carga bloqueando la app.
setTimeout(quitarSplashSinEsperarCargaTotal, 2500);
