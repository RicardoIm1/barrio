// ==================== API CLIENT CON JSONP ====================
const API = {
  baseUrl: 'https://script.google.com/macros/s/AKfycbwsyNp1BFuC4cTyNEy33q5Mj1HrgkILz_wYfoqu21oRKRbNPpBXWuPZVcRPHt1kI9Iq/exec',

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

  // Petición usando JSONP (evita CORS completamente)
  peticionJSONP(accion, datos = {}) {
    return new Promise((resolve, reject) => {
      const callbackName = 'jsonp_callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
      
      const payload = {
        accion: accion,
        datos: datos,
        coleccion: 'AVISOS',
        consulta: datos.consulta || {},
        paginacion: datos.paginacion || {},
        api_key: this.apiKey
      };
      
      // Construir URL con JSONP
      const url = this.baseUrl + '?callback=' + callbackName + '&jsonp=' + encodeURIComponent(JSON.stringify(payload));
      
      // Crear callback global
      window[callbackName] = function(respuesta) {
        delete window[callbackName];
        document.body.removeChild(script);
        if (respuesta && respuesta.success) {
          resolve(respuesta.data);
        } else {
          reject(new Error(respuesta?.error || 'Error en la petición'));
        }
      };
      
      // Crear y agregar script
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

  async listar(coleccion, consulta = {}, paginacion = {}) {
    try {
      const resultado = await this.peticionJSONP('LISTAR', { 
        coleccion, 
        consulta, 
        paginacion 
      });
      return resultado;
    } catch(error) {
      console.error('Error en listar:', error);
      this.mostrarError('Error al cargar avisos: ' + error.message);
      throw error;
    }
  },

  async login(email, password) {
    try {
      const resultado = await this.peticionJSONP('LOGIN', { email, password });
      if (resultado.api_key) {
        this.apiKey = resultado.api_key;
        localStorage.setItem('usuario', JSON.stringify(resultado.usuario));
      }
      return resultado;
    } catch(error) {
      this.mostrarError('Error en login: ' + error.message);
      throw error;
    }
  },

  logout() {
    this.apiKey = null;
    localStorage.removeItem('usuario');
  },

  mostrarError(mensaje) {
    const contenedor = document.getElementById('mensaje-container');
    if (contenedor) {
      contenedor.innerHTML = `<div class="mensaje mensaje-error">${mensaje}</div>`;
      setTimeout(() => { contenedor.innerHTML = ''; }, 5000);
    } else {
      console.error(mensaje);
    }
  },

  mostrarExito(mensaje) {
    const contenedor = document.getElementById('mensaje-container');
    if (contenedor) {
      contenedor.innerHTML = `<div class="mensaje mensaje-exito">${mensaje}</div>`;
      setTimeout(() => { contenedor.innerHTML = ''; }, 5000);
    }
  }
};