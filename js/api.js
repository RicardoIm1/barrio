// ==================== LIMPIAR SESIÓN CORRUPTA ====================
(function limpiarSesionCorrupta() {
    const usuarioStr = localStorage.getItem('usuario');
    if (usuarioStr && !usuarioStr.startsWith('{') && !usuarioStr.startsWith('[')) {
        console.warn('⚠️ Limpiando sesión corrupta:', usuarioStr);
        localStorage.removeItem('usuario');
        localStorage.removeItem('api_key');
    }
})();
// ================================================================

// ==================== API CLIENT - Jardines PVR ====================

const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbzYHyORKM8Xu55k6NMbnFmEniveGt1__WO28qVoU5n2F1MEqsqbYtT_UCzI7U2yw-8U/exec';

// Al inicio del archivo, después de const API_BASE_URL
if (window.location.hostname !== 'localhost') {
  console.log = function () { }; // Desactiva logs en producción
}

// ==================== CLASE PRINCIPAL ====================

class API {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  // ==================== NUEVO MÉTODO REQUEST (UNIVERSAL) ====================
  static async request(accion, datos = {}, apiKey = null) {
    apiKey = apiKey || localStorage.getItem('api_key');

    const body = {
      accion: accion,
      ...datos
    };

    if (apiKey) {
      body.api_key = apiKey;
    }

    console.log(`📤 ${accion} - Enviando:`, body);

    try {
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const resultado = await response.json();
      console.log(`📥 ${accion} - Respuesta:`, resultado);
      return resultado;

    } catch (error) {
      console.error(`❌ ${accion} - Error:`, error);
      throw error;
    }
  }

  // ==================== MÉTODOS ESTÁTICOS PRINCIPALES ====================

  // Método principal para hacer peticiones JSONP
  static async peticion(accion, datos = {}, apiKey = null, intentos = 2) {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams();
      params.append('accion', accion);
      if (apiKey) params.append('api_key', apiKey);

      for (const [key, value] of Object.entries(datos)) {
        if (value !== undefined && value !== null) {
          params.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
        }
      }

      const callbackName = 'callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
      const url = `${API_BASE_URL}?callback=${callbackName}&${params.toString()}`;

      console.log('📡 Petición JSONP URL:', url);

      const timeout = setTimeout(() => {
        if (window[callbackName]) {
          delete window[callbackName];
          if (intentos > 0) {
            console.warn(`⚠️ Timeout, reintentando... (quedan ${intentos} intentos)`);
            this.peticion(accion, datos, apiKey, intentos - 1).then(resolve).catch(reject);
          } else {
            reject(new Error('Timeout de conexión'));
          }
        }
      }, 30000);

      window[callbackName] = (response) => {
        clearTimeout(timeout);
        delete window[callbackName];
        console.log('📡 Respuesta JSONP:', response);
        resolve(response);
      };

      const script = document.createElement('script');
      script.src = url;
      script.onerror = () => {
        clearTimeout(timeout);
        delete window[callbackName];
        if (intentos > 0) {
          console.warn(`⚠️ Error de script, reintentando... (quedan ${intentos} intentos)`);
          this.peticion(accion, datos, apiKey, intentos - 1).then(resolve).catch(reject);
        } else {
          reject(new Error('Error de conexión con el servidor'));
        }
      };
      document.body.appendChild(script);
    });
  }

  static async post(accion, datos = {}, apiKey = null) {

    apiKey = apiKey || localStorage.getItem('api_key');

    try {

      const body = {
        accion,
        ...datos
      };

      if (apiKey) {
        body.api_key = apiKey;
      }

      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(body)
      });

      return await response.json();

    } catch (error) {

      console.error('Error POST:', error);
      throw error;
    }
  }

  // ==================== MÉTODOS DE AUTENTICACIÓN ====================

  // Login
  static async login(email, password) {
    try {
      const resultado = await API.post('LOGIN', { email: email, password: password });

      if (resultado && resultado.success && resultado.data && resultado.data.api_key) {
        localStorage.setItem('api_key', resultado.data.api_key);
        localStorage.setItem('usuario', JSON.stringify(resultado.data.usuario));
        window.dispatchEvent(new CustomEvent('auth-change', { detail: { usuario: resultado.data.usuario } }));
        window.dispatchEvent(new Event('storage'));
        return resultado.data;
      } else {
        throw new Error(resultado?.error || 'Credenciales inválidas');
      }
    } catch (error) {
      console.error('Error en login API:', error);
      throw error;
    }
  }

  // Registro
  static async registro(datos) {
    try {
      const resultado = await API.peticion('REGISTRO', { datos: datos });

      if (resultado && resultado.success && resultado.data && resultado.data.api_key) {
        return resultado.data;  // ← Debe contener api_key y usuario
      } else {
        throw new Error(resultado?.error || 'Error en registro');
      }
    } catch (error) {
      console.error('Error en registro API:', error);
      throw error;
    }
  }

  // Cerrar sesión
  static logout() {
    const apiKey = localStorage.getItem('api_key');
    if (apiKey) {
      API.peticion('LOGOUT', {}, apiKey).catch(() => { });
    }
    localStorage.removeItem('api_key');
    localStorage.removeItem('usuario');
    window.dispatchEvent(new CustomEvent('auth-change', { detail: { usuario: null } }));
    window.dispatchEvent(new Event('storage'));
    console.log('🔓 Sesión cerrada');
  }

  // Obtener usuario actual
  static getUsuarioActual() {
    try {
      const usuarioStr = localStorage.getItem('usuario');
      if (!usuarioStr) return null;

      // ✅ Protección contra datos corruptos
      const trimmed = usuarioStr.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        console.warn('⚠️ Usuario corrupto detectado, limpiando...', usuarioStr);
        localStorage.removeItem('usuario');
        return null;
      }

      const usuario = JSON.parse(usuarioStr);
      if (!usuario || typeof usuario !== 'object') {
        localStorage.removeItem('usuario');
        return null;
      }

      if (!usuario.email) return null;
      return usuario;
    } catch (e) {
      console.error('Error parsing usuario:', e);
      localStorage.removeItem('usuario');
      return null;
    }
  }

  // Verificar si hay sesión
  static isLoggedIn() {
    return !!API.getUsuarioActual();
  }

  // ==================== MÉTODOS DE AVISOS ====================

  // Listar avisos
  static async listar(coleccion, filtros = {}, paginacion = {}) {
    const apiKey = localStorage.getItem('api_key');
    const usuario = API.getUsuarioActual();
    const esAdmin = usuario && usuario.rol === 'admin';

    // Construir parámetros base
    const params = {
      coleccion: coleccion,
      ...paginacion
    };

    // Si NO es admin Y hay usuario logueado, filtrar por sus propios avisos
    if (coleccion === 'AVISOS' && !esAdmin && usuario) {
      params.created_by = usuario.id;
    }

    // Agregar filtros adicionales (Aquí es crucial que admin.js envíe { estado: 'pendiente' } u otros)
    Object.assign(params, filtros);

    // Mantenemos JSONP para listar ya que GET suele ser seguro para lecturas paginadas
    const resultado = await API.peticion('LISTAR', params, apiKey);

    if (resultado && resultado.success) {
      return resultado.data || { datos: [], total: 0 };
    }

    if (resultado && resultado.datos) {
      return resultado;
    }

    return { datos: [], total: 0 };
  }

  // Crear aviso (Asegura que "datos" incluya la propiedad imagen_url correctamente)
  static async crearAviso(datos, apiKey) {
    return await API.post('CREAR', {
      coleccion: 'AVISOS',
      datos: datos
    }, apiKey);
  }

  // Actualizar aviso (Migrado a estructura limpia para el backend)
  static async actualizarAviso(id, datos, apiKey) {
    return await API.post('ACTUALIZAR', {
      coleccion: 'AVISOS',
      id: id,
      datos: datos
    }, apiKey);
  }

  // Eliminar (Migrado a POST para evitar fallos de permisos por URL)
  static async eliminar(coleccion, id, apiKey) {
    return await API.post('ELIMINAR', {
      coleccion: coleccion,
      id: id
    }, apiKey);
  }

  // Aprobar aviso (¡Corregido a POST real para evitar truncado de datos!)
  static async aprobarAviso(id, apiKey) {
    return await API.post('APROBAR_AVISO', {
      id: id
    }, apiKey);
  }

  // Rechazar aviso (¡Corregido a POST real!)
  static async rechazarAviso(id, apiKey) {
    return await API.post('RECHAZAR_AVISO', {
      id: id
    }, apiKey);
  }


  // ==================== MÉTODOS DE ESTADÍSTICAS ====================

  static async registrarVista(id) {
    return await API.peticion('REGISTRAR_VISTA', { id: id });
  }

  static async registrarClickWhatsApp(id) {
    return await API.peticion('REGISTRAR_CLICK_WHATSAPP', { id: id });
  }

  static async registrarInteres(id) {
    return await API.peticion('REGISTRAR_INTERES', { id: id });
  }

  // ==================== MÉTODOS DE COMENTARIOS ====================

  static async listarComentarios(avisoId) {
    const resultado = await API.peticion('LISTAR_COMENTARIOS', { avisoId: avisoId });
    if (resultado && resultado.success) {
      return resultado.data || [];
    }
    return [];
  }

  static async agregarComentario(avisoId, texto, autor) {
    return await API.peticion('AGREGAR_COMENTARIO', {
      avisoId: avisoId,
      texto: texto,
      autor: autor
    });
  }

  // ==================== MÉTODOS DE REPUTACIÓN ====================

  static async miReputacion(apiKey) {
    return await API.peticion('MI_REPUTACION', {}, apiKey);
  }

  static async solicitarVerificacionTelefono(telefono, apiKey) {
    return await API.peticion('VERIFICAR_TELEFONO_SOLICITAR', { telefono: telefono }, apiKey);
  }

  static async confirmarVerificacionTelefono(codigo, apiKey) {
    return await API.peticion('VERIFICAR_TELEFONO_CONFIRMAR', { codigo: codigo }, apiKey);
  }

  static async votarAviso(avisoId, tipo, apiKey) {
    return await API.peticion('VOTAR_AVISO', {
      aviso_id: avisoId,
      tipo: tipo
    }, apiKey);
  }

  static async reportarAviso(avisoId, motivo, apiKey) {
    return await API.peticion('REPORTAR_AVISO', { aviso_id: avisoId, motivo: motivo }, apiKey);
  }

  // ==================== MÉTODOS DE USUARIOS (ADMIN) ====================

  static async listarUsuarios(apiKey) {
    const resultado = await API.request('LISTAR_USUARIOS', {}, apiKey);
    if (resultado && resultado.success) {
      return resultado.data || { datos: [] };
    }
    return { datos: [] };
  }

  static async actualizarUsuario(id, datos, apiKey) {
    return await API.peticion('ACTUALIZAR', {
      coleccion: 'USUARIOS',
      id: id,
      datos: datos
    }, apiKey);
  }
}

// ==================== FUNCIÓN DE RESPALDO ====================

window.llamarAPI = async function (accion, datos = {}, apiKey = null) {
  return await API.peticion(accion, datos, apiKey);
};

// ==================== INICIALIZACIÓN ====================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('api-ready'));
      console.log('✅ API Client inicializado correctamente');
    }, 100);
  });
} else {
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('api-ready'));
    console.log('✅ API Client inicializado correctamente');
  }, 100);
}

window.API = API;

window.addEventListener('storage', (e) => {
  if (e.key === 'api_key' || e.key === 'usuario') {
    console.log('🔄 Cambio de sesión detectado en otra pestaña');
    window.dispatchEvent(new CustomEvent('auth-change', {
      detail: { usuario: API.getUsuarioActual() }
    }));
  }
});

console.log('📡 API Client cargado. API_BASE_URL:', API_BASE_URL);

// ==================== FUNCIONES DE UI ====================
API.mostrarExito = function (mensaje) {
  console.log('✅ Éxito:', mensaje);
  const container = document.getElementById('mensaje-container');
  if (container) {
    container.innerHTML = `<div class="mensaje mensaje-exito" style="background: #d4edda; color: #155724; padding: 12px; border-radius: 8px; margin-bottom: 16px;">✅ ${mensaje}</div>`;
    setTimeout(() => {
      if (container.innerHTML.includes(mensaje)) {
        container.innerHTML = '';
      }
    }, 4000);
  } else {
    alert(mensaje);
  }
};

API.mostrarError = function (mensaje) {
  console.error('❌ Error:', mensaje);
  const container = document.getElementById('mensaje-container');
  if (container) {
    container.innerHTML = `<div class="mensaje mensaje-error" style="background: #f8d7da; color: #721c24; padding: 12px; border-radius: 8px; margin-bottom: 16px;">❌ ${mensaje}</div>`;
    setTimeout(() => {
      if (container.innerHTML.includes(mensaje)) {
        container.innerHTML = '';
      }
    }, 4000);
  } else {
    alert('Error: ' + mensaje);
  }
};

// ========== LISTAR MIS AVISOS (para panel de administración) ==========
API.listarMisAvisos = async function (filtros = {}, paginacion = {}) {
  const apiKey = localStorage.getItem('api_key');
  if (!apiKey) {
    console.warn('No hay API key, no se pueden cargar avisos');
    return { datos: [], total: 0 };
  }

  const params = {
    accion: 'LISTAR_MIS_AVISOS',
    ...filtros,
    ...paginacion
  };

  const resultado = await API.peticion('LISTAR_MIS_AVISOS', params, apiKey);

  if (resultado && resultado.success) {
    return resultado.data || { datos: [], total: 0 };
  }

  console.error('Error en listarMisAvisos:', resultado);
  return { datos: [], total: 0 };
};

// ========== LISTAR AVISOS PÚBLICOS (para index.html) ==========
API.listarPublicos = async function (filtros = {}, paginacion = {}) {
  const params = {
    accion: 'LISTAR_AVISOS_PUBLICOS',
    ...filtros,
    ...paginacion
  };

  // Usar peticion (JSONP) en lugar de post
  const resultado = await API.peticion('LISTAR_AVISOS_PUBLICOS', params);

  if (resultado && resultado.success) {
    return resultado.data || { datos: [], total: 0 };
  }

  console.error('Error en listarPublicos:', resultado);
  return { datos: [], total: 0 };
};