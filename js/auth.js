console.log('🔵 auth.js cargando...');

const EL_BARRIO_SUPABASE_URL = 'https://gnjaumpjerbbwlkcgxqa.supabase.co';
const EL_BARRIO_SUPABASE_KEY = 'sb_publishable_x01F_xzyh5b-sZdwhKh6FQ_OzQVxMpN';

let presenciaVisibilityHandler = null;
let presenciaActivityHandler = null;
let presenciaIntervalo = null;
let ultimaPresenciaRegistrada = 0;
let moderacionChannel = null;
let moderacionIniciada = false;
let votarAvisoOriginal = null;

async function obtenerSupabaseClient() {
  if (window.__elBarrioGetSupabaseClient) return await window.__elBarrioGetSupabaseClient();
  if (typeof window.getSupabaseClient === 'function') return await window.getSupabaseClient();
  if (typeof supabaseClient !== 'undefined' && supabaseClient) return supabaseClient;
  if (window.__elBarrioSupabaseClient) return window.__elBarrioSupabaseClient;
  throw new Error('Cliente Supabase no disponible');
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
  const objetivo = String(id);

  // El índice usa allAvisos/filteredAvisos para su scroll infinito.
  // Actualizamos esos arrays localmente para que el card desaparezca sin
  // reconstruir ni recargar todo el feed.
  if (typeof allAvisos !== 'undefined' && Array.isArray(allAvisos)) {
    const antes = allAvisos.length;
    allAvisos = allAvisos.filter(a => String(a.id) !== objetivo);
    if (typeof filteredAvisos !== 'undefined' && Array.isArray(filteredAvisos)) {
      filteredAvisos = filteredAvisos.filter(a => String(a.id) !== objetivo);
    }
    if (antes !== allAvisos.length && typeof renderedCount !== 'undefined' && renderedCount > 0) {
      renderedCount = Math.max(0, renderedCount - 1);
    }
    if (typeof hasMore !== 'undefined') {
      hasMore = typeof renderedCount !== 'undefined' ? renderedCount < filteredAvisos.length : false;
    }
  }

  // Compatibilidad con aviso.html y el paginado antiguo.
  if (typeof todosLosAvisos !== 'undefined' && Array.isArray(todosLosAvisos)) {
    todosLosAvisos = todosLosAvisos.filter(a => String(a.id) !== objetivo);
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

  // Solo redirigimos cuando realmente estamos dentro de aviso.html.
  // En el índice, la desaparición debe ser exclusivamente local.
  const paper = document.querySelector('.aviso-paper');
  const avisoIdActual = typeof AVISO_ID !== 'undefined' ? String(AVISO_ID || '') : '';
  if (paper && avisoIdActual && avisoIdActual === avisoId) {
    if (!paper.classList.contains('aviso-apagando-tv')) {
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

      // El índice usa scroll infinito y ya actualizamos sus arrays arriba.
      // No llamamos a filtrarYAplicarPaginacion(), porque esa función pertenece
      // al renderizador antiguo de app.js y reconstruiría el contenedor vacío.
      if (typeof allAvisos !== 'undefined' && Array.isArray(allAvisos)) return;

      // En aviso.html/otras vistas antiguas sí mantenemos la actualización local.
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
  if (presenciaIntervalo) {
    clearInterval(presenciaIntervalo);
    presenciaIntervalo = null;
  }
  if (presenciaVisibilityHandler) {
    document.removeEventListener('visibilitychange', presenciaVisibilityHandler);
    presenciaVisibilityHandler = null;
  }
  if (presenciaActivityHandler) {
    ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(evento =>
      document.removeEventListener(evento, presenciaActivityHandler, true)
    );
    presenciaActivityHandler = null;
  }
}

async function iniciarPresencia() {
  detenerPresencia();
  const registrarSiCorresponde = async (forzar = false) => {
    const ahora = Date.now();
    if (!forzar && ahora - ultimaPresenciaRegistrada < 20000) return;
    const ok = await registrarPresencia();
    if (ok) ultimaPresenciaRegistrada = Date.now();
  };

  await registrarSiCorresponde(true);
  presenciaIntervalo = window.setInterval(() => {
    registrarSiCorresponde(true);
  }, 45000);

  presenciaActivityHandler = () => registrarSiCorresponde(false);
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(evento =>
    document.addEventListener(evento, presenciaActivityHandler, { capture: true, passive: true })
  );

  presenciaVisibilityHandler = () => {
    if (!document.hidden) registrarSiCorresponde(true);
  };
  document.addEventListener('visibilitychange', presenciaVisibilityHandler);
  return true;
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

function actualizarEnlacesAdminHeader(usuario) {
  const esAdmin = usuario?.rol === 'admin' && usuario?.activo !== false;
  document.querySelectorAll('.admin-only-menu-link').forEach(link => {
    link.hidden = !esAdmin;
    link.style.display = esAdmin ? 'flex' : 'none';
  });
}

function guardarCompatibilidad(usuario, session) {
  localStorage.setItem('usuario', JSON.stringify(usuario));
  if (session?.access_token) localStorage.setItem('api_key', session.access_token);
  actualizarEnlacesAdminHeader(usuario);
}

const Auth = {
  async login(email, password) {
    const client = await obtenerSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) {
      const usuario = await construirUsuario(client, data.user);
      guardarCompatibilidad(usuario, data.session);
      await iniciarPresencia();
      iniciarEscuchaModeracion();
      console.log('🟢 Sesión Supabase reconocida:', usuario);
    }
    return data;
  },
  async requireAuth() {
    const client = await obtenerSupabaseClient();

    // Supabase puede tardar unos instantes en restaurar la sesión persistida
    // desde localStorage. No confundimos ese estado transitorio con un logout.
    for (let intento = 1; intento <= 12; intento++) {
      const { data, error } = await client.auth.getSession();
      if (error) {
        console.warn(`⚠️ Comprobación de sesión ${intento}/12:`, error.message);
      } else if (data?.session?.user) {
        const usuario = await construirUsuario(client, data.session.user);
        guardarCompatibilidad(usuario, data.session);
        await iniciarPresencia();
        iniciarEscuchaModeracion();
        return usuario;
      }

      // 1.ª espera corta, después dejamos que el cliente termine su
      // inicialización/refresh. Máximo aproximado: 4 segundos.
      if (intento < 12) {
        await new Promise(resolve => setTimeout(resolve, intento === 1 ? 150 : 350));
      }
    }

    detenerPresencia();
    return null;
  },
  async logout() {
    const client = await obtenerSupabaseClient();
    await cerrarPresencia();
    detenerPresencia();
    const { error } = await client.auth.signOut();
    if (error) { console.error('❌ Error cerrando sesión:', error); throw error; }
    localStorage.removeItem('usuario');
    localStorage.removeItem('api_key');
    actualizarEnlacesAdminHeader(null);
    console.log('🔓 Sesión Supabase cerrada');
  }
};


window.Auth = Auth;
window.obtenerSupabaseClient = obtenerSupabaseClient;

// Inicialización única del encabezado compartido. También cubre páginas que
// insertan common/header.html mediante innerHTML, donde los scripts del fragmento no se ejecutan.
function inicializarHeaderAuth() {
  const root = document.getElementById('header-container') || document;
  const login = root.querySelector('#login-link');
  const userArea = root.querySelector('#user-area');
  const userName = root.querySelector('#user-name');
  const logout = root.querySelector('#cerrar-sesion');
  const toggle = root.querySelector('#header-menu-toggle');
  const menu = root.querySelector('#header-acciones');

  let usuario = null;
  try {
    const raw = localStorage.getItem('usuario');
    if (raw && localStorage.getItem('api_key')) usuario = JSON.parse(raw);
  } catch (error) {
    console.warn('No se pudo leer la sesión del encabezado:', error);
  }

  if (usuario) {
    if (login) login.style.display = 'none';
    if (userArea) userArea.style.display = 'flex';
    if (userName) {
      userName.textContent = '👋 ' + (usuario.nombre || usuario.email || 'Usuario');
      userName.classList.add('admin-link');
      userName.title = 'Abrir panel de administración';
      userName.setAttribute('role', 'link');
      userName.setAttribute('tabindex', '0');
      userName.onclick = function () { window.location.href = '/admin.html'; };
      userName.onkeydown = function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          window.location.href = '/admin.html';
        }
      };
    }
  } else {
    if (login) login.style.display = 'inline-flex';
    if (userArea) userArea.style.display = 'none';
  }
  actualizarEnlacesAdminHeader(usuario);

  if (logout && logout.dataset.logoutInit !== '1') {
    logout.dataset.logoutInit = '1';
    logout.addEventListener('click', async function (event) {
      event.preventDefault();
      event.stopPropagation();
      try {
        await Auth.logout();
      } catch (error) {
        console.error('Error al cerrar sesión:', error);
        localStorage.removeItem('usuario');
        localStorage.removeItem('api_key');
      }
      window.location.href = '/index.html';
    });
  }

  if (toggle && menu && toggle.dataset.menuInit !== '1') {
    toggle.dataset.menuInit = '1';
    const cerrar = function () {
      menu.classList.remove('menu-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Abrir menú');
    };
    toggle.addEventListener('click', function (event) {
      event.stopPropagation();
      if (toggle.getAttribute('aria-expanded') === 'true') cerrar();
      else {
        menu.classList.add('menu-open');
        toggle.setAttribute('aria-expanded', 'true');
        toggle.setAttribute('aria-label', 'Cerrar menú');
      }
    });
  }
}
window.inicializarHeaderAuth = inicializarHeaderAuth;

if (!window.__elBarrioHeaderObserversInstalled) {
  window.__elBarrioHeaderObserversInstalled = true;
  document.addEventListener('pointerdown', function (event) {
    const menu = document.getElementById('header-acciones');
    const toggle = document.getElementById('header-menu-toggle');
    if (menu && toggle && !menu.contains(event.target) && !toggle.contains(event.target)) {
      menu.classList.remove('menu-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Abrir menú');
    }
  });
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    const menu = document.getElementById('header-acciones');
    const toggle = document.getElementById('header-menu-toggle');
    if (menu && toggle) {
      menu.classList.remove('menu-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Abrir menú');
    }
  });
  window.addEventListener('resize', function () {
    if (window.innerWidth <= 768) return;
    const menu = document.getElementById('header-acciones');
    const toggle = document.getElementById('header-menu-toggle');
    if (menu && toggle) {
      menu.classList.remove('menu-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Abrir menú');
    }
  });
  const observer = new MutationObserver(function () {
    if (document.getElementById('header-menu-toggle')) {
      observer.disconnect();
      inicializarHeaderAuth();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.getElementById('header-menu-toggle')) {
    observer.disconnect();
    inicializarHeaderAuth();
  }
}


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

setTimeout(() => {
  iniciarEscuchaModeracion();
}, 1800);

let presenciaAuthListenerInstalado = false;

async function iniciarPresenciaSiExisteSesion() {
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
          iniciarPresencia().catch(error => console.warn('⚠️ Presencia tras cambio de sesión:', error?.message || error));
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

setTimeout(quitarSplashSinEsperarCargaTotal, 2500);