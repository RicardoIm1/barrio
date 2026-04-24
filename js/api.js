// ==================== API CLIENT - Jardines PVR ====================

const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbwDNJNR-bmG7lY_PM1qOHD_QJBBL_DOnhO2W-id5VCTb9bTlJptwfA_6vbehIY8vVs6/exec';

// ==================== CLASE PRINCIPAL ====================

class API {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  // ==================== MÉTODOS ESTÁTICOS PRINCIPALES ====================

  // Método principal para hacer peticiones JSONP
  static async peticion(accion, datos = {}, apiKey = null) {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams();
      params.append('accion', accion);

      if (apiKey) params.append('api_key', apiKey);

      // Para datos complejos, los enviamos como JSON string
      if (datos && Object.keys(datos).length > 0) {
        // En lugar de anidar, enviar cada propiedad directamente
        for (const [key, value] of Object.entries(datos)) {
          if (value !== undefined && value !== null) {
            params.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
          }
        }
      }

      const callbackName = 'callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
      const url = `${API_BASE_URL}?callback=${callbackName}&${params.toString()}`;

      console.log('📡 Petición URL:', url);

      const timeout = setTimeout(() => {
        if (window[callbackName]) {
          delete window[callbackName];
          reject(new Error('Timeout de conexión'));
        }
      }, 30000);

      window[callbackName] = function (response) {
        clearTimeout(timeout);
        delete window[callbackName];
        console.log('📡 Respuesta:', response);
        resolve(response);
      };

      const script = document.createElement('script');
      script.src = url;
      script.onerror = () => {
        clearTimeout(timeout);
        delete window[callbackName];
        reject(new Error('Error de conexión con el servidor'));
      };
      document.body.appendChild(script);
    });
  }

  // ==================== MÉTODOS DE AUTENTICACIÓN ====================

  // Login
  static async login(email, password) {
    try {
      const resultado = await API.peticion('LOGIN', { email: email, password: password });

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
        localStorage.setItem('api_key', resultado.data.api_key);
        localStorage.setItem('usuario', JSON.stringify(resultado.data.usuario));
        window.dispatchEvent(new CustomEvent('auth-change', { detail: { usuario: resultado.data.usuario } }));
        window.dispatchEvent(new Event('storage'));
        return resultado.data;
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
      const usuario = JSON.parse(usuarioStr);
      // Verificar que no sea el string "undefined"
      if (usuario === 'undefined' || !usuario.email) return null;
      return usuario;
    } catch (e) {
      console.error('Error parsing usuario:', e);
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

    // Si NO es admin, filtrar por sus propios avisos (solo para colección AVISOS)
    if (coleccion === 'AVISOS' && !esAdmin) {
      params.created_by = usuario.id;
    }

    // Agregar filtros adicionales (sobrescriben si es necesario)
    Object.assign(params, filtros);

    const resultado = await API.peticion('LISTAR', params, apiKey);

    if (resultado && resultado.success) {
      return resultado.data || { datos: [], total: 0 };
    }

    if (resultado && resultado.datos) {
      return resultado;
    }

    return { datos: [], total: 0 };
  }

  // Obtener un aviso específico
  static async obtenerAviso(id) {
    const resultado = await API.listar('AVISOS', { id: id });
    if (resultado && resultado.datos && resultado.datos.length > 0) {
      return resultado.datos[0];
    }
    return null;
  }

  // Crear aviso
  static async crearAviso(datos, apiKey) {
    // Enviar los datos DENTRO de un objeto llamado "datos"
    return await API.peticion('CREAR', {
      coleccion: 'AVISOS',
      datos: datos  // <-- Aquí está la clave: anidar dentro de "datos"
    }, apiKey);
  }

  // Actualizar aviso
  static async actualizarAviso(id, datos, apiKey) {
    return await API.peticion('ACTUALIZAR', {
      coleccion: 'AVISOS',
      id: id,
      datos: datos
    }, apiKey);
  }

  static async eliminar(coleccion, id, apiKey) {
    return await API.peticion('ELIMINAR', {
      coleccion: coleccion,
      id: id
    }, apiKey);
  }

  // Aprobar aviso (admin)
  static async aprobarAviso(id, apiKey) {
    return await API.peticion('APROBAR_AVISO', { id: id }, apiKey);
  }

  // Rechazar aviso (admin)
  static async rechazarAviso(id, apiKey) {
    return await API.peticion('RECHAZAR_AVISO', { id: id }, apiKey);
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
    return await API.peticion('VOTAR_AVISO', { aviso_id: avisoId, tipo: tipo }, apiKey);
  }

  static async reportarAviso(avisoId, motivo, apiKey) {
    return await API.peticion('REPORTAR_AVISO', { aviso_id: avisoId, motivo: motivo }, apiKey);
  }

  // ==================== MÉTODOS DE USUARIOS (ADMIN) ====================

  static async listarUsuarios(apiKey) {
    const resultado = await API.peticion('LISTAR', { coleccion: 'USUARIOS' }, apiKey);
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

  const resultado = await API.peticion('LISTAR_AVISOS_PUBLICOS', params);

  if (resultado && resultado.success) {
    return resultado.data || { datos: [], total: 0 };
  }

  return { datos: [], total: 0 };
};