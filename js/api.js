// ==================== CONFIGURACIÓN ====================
const API = {
  baseUrl: 'https://script.google.com/macros/s/AKfycbzINnCQrPcFUrT4eUZ0M2KjJ4rN3wqA2HeUAGjJlBijP_VlNiiFjH21e4e-tnzdPQs4/exec',

  // Timeout para peticiones (30 segundos)
  timeout: 30000,

  get apiKey() {
    return localStorage.getItem('api_key');
  },

  set apiKey(valor) {
    if (valor) {
      localStorage.setItem('api_key', valor);
    } else {
      localStorage.removeItem('api_key');
    }
  },

  // ==================== MÉTODO PRINCIPAL CON MEJOR MANEJO ====================
  async peticion(accion, coleccion = null, datos = {}, id = null, consulta = {}, paginacion = {}) {
    const payload = {
      accion: accion,
      coleccion: coleccion,
      datos: datos,
      id: id,
      consulta: consulta,
      paginacion: paginacion,
      api_key: this.apiKey
    };

    // Control de reintentos
    let ultimoError = null;
    for (let intento = 1; intento <= 3; intento++) {
      try {
        // Crear AbortController para timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const respuesta = await fetch(this.baseUrl, {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: {
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!respuesta.ok) {
          throw new Error(`HTTP ${respuesta.status}: ${respuesta.statusText}`);
        }

        const resultado = await respuesta.json();

        if (!resultado.success) {
          throw new Error(resultado.error || 'Error en la operación');
        }

        return resultado.data;

      } catch (error) {
        ultimoError = error;
        console.warn(`Intento ${intento} fallido:`, error.message);

        // Si es error de red, esperar antes de reintentar
        if (error.name === 'TypeError' || error.name === 'AbortError') {
          if (intento < 3) {
            await new Promise(resolve => setTimeout(resolve, 2000 * intento));
            continue;
          }
        }
        break;
      }
    }

    // Si llegamos aquí, todos los intentos fallaron
    console.error('API Error después de 3 intentos:', ultimoError);

    // Mensaje de error más amigable
    let mensajeError = 'No se pudo conectar con el servidor. ';
    if (ultimoError.name === 'AbortError') {
      mensajeError += 'La petición tomó demasiado tiempo.';
    } else if (ultimoError.message && ultimoError.message.includes('Failed to fetch')) {
      mensajeError += 'Verifica tu conexión a internet.';
    } else if (ultimoError.message) {
      mensajeError += ultimoError.message;
    }

    this.mostrarError(mensajeError);
    throw new Error(mensajeError);
  },

  // ==================== MÉTODOS CRUD ====================
  crear: (coleccion, datos) => API.peticion('CREAR', coleccion, datos),

  leer: (coleccion, id) => API.peticion('LEER', coleccion, {}, id),

  actualizar: (coleccion, id, datos) => API.peticion('ACTUALIZAR', coleccion, datos, id),

  eliminar: (coleccion, id) => API.peticion('ELIMINAR', coleccion, {}, id),

  listar: (coleccion, consulta = {}, paginacion = {}) =>
    API.peticion('LISTAR', coleccion, {}, null, consulta, paginacion),

  // ==================== AUTENTICACIÓN ====================
  async login(email, clave) {
    try {
      const resultado = await this.peticion('LOGIN', null, { email, clave });
      if (resultado && resultado.api_key) {
        this.apiKey = resultado.api_key;
        localStorage.setItem('usuario', JSON.stringify(resultado.usuario));
      }
      return resultado;
    } catch (error) {
      this.mostrarError('Error al iniciar sesión: ' + error.message);
      throw error;
    }
  },

  logout() {
    this.apiKey = null;
    localStorage.removeItem('usuario');
  },

  getUsuarioActual() {
    const usuario = localStorage.getItem('usuario');
    return usuario ? JSON.parse(usuario) : null;
  },

  // ==================== NOTIFICACIONES ====================
  async guardarTokenFCM(token, dispositivo) {
    return this.peticion('GUARDAR_TOKEN', null, { token, dispositivo });
  },

  // ==================== UTILERÍAS ====================
  mostrarError(mensaje) {
    const contenedor = document.getElementById('mensaje-container');
    if (contenedor) {
      contenedor.innerHTML = `<div class="mensaje mensaje-error">⚠️ ${mensaje}</div>`;
      setTimeout(() => {
        if (contenedor.innerHTML.includes(mensaje)) {
          contenedor.innerHTML = '';
        }
      }, 8000);
    } else {
      console.error('Error:', mensaje);
    }
  },

  mostrarExito(mensaje) {
    const contenedor = document.getElementById('mensaje-container');
    if (contenedor) {
      contenedor.innerHTML = `<div class="mensaje mensaje-exito">✓ ${mensaje}</div>`;
      setTimeout(() => {
        if (contenedor.innerHTML.includes(mensaje)) {
          contenedor.innerHTML = '';
        }
      }, 5000);
    }
  },

  // Método para verificar conectividad
  async verificarConexion() {
    try {
      await fetch(this.baseUrl, {
        method: 'HEAD',
        mode: 'no-cors'
      });
      return true;
    } catch (error) {
      console.warn('No hay conexión con el servidor');
      return false;
    }
  }
};