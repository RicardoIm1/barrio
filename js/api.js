// ==================== API CLIENT CON JSONP ====================
const API = {
  baseUrl: 'https://script.google.com/macros/s/AKfycby_68N-wRMXs0nA9khuOKWn2PJWKHX08g8UL1EMaWkCx84XL8H28F2G-ePc0IM-5KcJ/exec',

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

  getUsuarioActual() {
    const usuario = localStorage.getItem('usuario');
    return usuario ? JSON.parse(usuario) : null;
  },

  // Petición usando JSONP
  peticionJSONP(accion, datos = {}) {
    return new Promise((resolve, reject) => {
      const callbackName = 'jsonp_callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);

      const payload = {
        accion: accion,
        ...datos,
        api_key: this.apiKey
      };

      console.log('📤 Enviando petición:', accion, payload);

      const url = this.baseUrl + '?callback=' + callbackName + '&jsonp=' + encodeURIComponent(JSON.stringify(payload));

      window[callbackName] = function (respuesta) {
        delete window[callbackName];
        if (document.body.contains(script)) document.body.removeChild(script);
        
        console.log('📥 Respuesta recibida:', respuesta);
        
        // ✅ Manejar diferentes formatos de respuesta
        if (respuesta && respuesta.success === true) {
          resolve(respuesta.data || respuesta);
        } else if (respuesta && respuesta.success === false) {
          reject(new Error(respuesta.error || 'Error en la petición'));
        } else if (respuesta && respuesta.data && respuesta.data.success !== undefined) {
          // Respuesta anidada
          if (respuesta.data.success) {
            resolve(respuesta.data.data || respuesta.data);
          } else {
            reject(new Error(respuesta.data.error || 'Error en la petición'));
          }
        } else {
          reject(new Error(respuesta?.error || 'Respuesta inválida del servidor'));
        }
      };

      const script = document.createElement('script');
      script.src = url;
      script.onerror = () => {
        delete window[callbackName];
        if (document.body.contains(script)) document.body.removeChild(script);
        reject(new Error('Error de conexión con el servidor'));
      };
      document.body.appendChild(script);
    });
  },

  async peticion(accion, datos = {}) {
    try {
      const resultado = await this.peticionJSONP(accion, datos);
      return resultado;
    } catch (error) {
      console.error('Error en petición:', error);
      throw error;
    }
  },

  async listar(coleccion, consulta = {}, paginacion = {}) {
    try {
      const resultado = await this.peticionJSONP('LISTAR', {
        coleccion,
        consulta,
        paginacion
      });
      return resultado;
    } catch (error) {
      console.error('Error en listar:', error);
      this.mostrarError('Error al cargar datos: ' + error.message);
      throw error;
    }
  },

  async crear(coleccion, datos) {
    try {
      const resultado = await this.peticionJSONP('CREAR', {
        coleccion,
        datos
      });
      return resultado;
    } catch (error) {
      console.error('Error en crear:', error);
      this.mostrarError('Error al crear: ' + error.message);
      throw error;
    }
  },

  async actualizar(coleccion, id, datos) {
    try {
      console.log('🔄 Actualizando:', { coleccion, id, datos });
      
      const resultado = await this.peticionJSONP('ACTUALIZAR', {
        coleccion,
        id,
        datos
      });
      
      console.log('✅ Actualización exitosa:', resultado);
      return resultado;
    } catch (error) {
      console.error('❌ Error en actualizar:', error);
      this.mostrarError('Error al actualizar: ' + error.message);
      throw error;
    }
  },

  async eliminar(coleccion, id) {
    try {
      const resultado = await this.peticionJSONP('ELIMINAR', {
        coleccion,
        id
      });
      return resultado;
    } catch (error) {
      console.error('Error en eliminar:', error);
      this.mostrarError('Error al eliminar: ' + error.message);
      throw error;
    }
  },

  async login(email, password) {
    try {
      const resultado = await this.peticionJSONP('LOGIN', { email, password });
      console.log('Respuesta LOGIN:', resultado);

      if (resultado) {
        if (resultado.api_key) {
          this.apiKey = resultado.api_key;
        }
        if (resultado.usuario) {
          localStorage.setItem('usuario', JSON.stringify(resultado.usuario));
        }
        return resultado;
      }
      throw new Error('Respuesta vacía del servidor');
    } catch (error) {
      this.mostrarError('Error en login: ' + error.message);
      throw error;
    }
  },

  cerrarSesion() {
    this.apiKey = null;
    localStorage.removeItem('usuario');
    localStorage.removeItem('api_key');
  },

  logout() {
    this.cerrarSesion();
  },

  mostrarError(mensaje) {
    const contenedor = document.getElementById('mensaje-container');
    if (contenedor) {
      contenedor.innerHTML = `<div class="mensaje mensaje-error">${mensaje}</div>`;
      setTimeout(() => {
        if (contenedor.innerHTML.includes(mensaje)) {
          contenedor.innerHTML = '';
        }
      }, 5000);
    } else {
      console.error(mensaje);
      alert(mensaje);
    }
  },

  mostrarExito(mensaje) {
    const contenedor = document.getElementById('mensaje-container');
    if (contenedor) {
      contenedor.innerHTML = `<div class="mensaje mensaje-exito">${mensaje}</div>`;
      setTimeout(() => {
        if (contenedor.innerHTML.includes(mensaje)) {
          contenedor.innerHTML = '';
        }
      }, 5000);
    } else {
      console.log(mensaje);
    }
  }
};

// Evento cuando API está lista
if (typeof window !== 'undefined') {
  setTimeout(() => {
    console.log('✅ API lista');
    window.dispatchEvent(new CustomEvent('api-ready'));
  }, 0);
}