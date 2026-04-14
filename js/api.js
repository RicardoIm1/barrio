// ==================== API CLIENT CON JSONP CORREGIDO ====================
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

  peticionJSONP(accion, datos = {}) {
    return new Promise((resolve, reject) => {
      const callbackName = 'callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
      
      const payload = {
        accion: accion,
        ...datos,
        api_key: this.apiKey
      };
      
      const url = this.baseUrl + '?callback=' + callbackName + '&jsonp=' + encodeURIComponent(JSON.stringify(payload));
      
      window[callbackName] = function(respuesta) {
        delete window[callbackName];
        if (document.body.contains(script)) document.body.removeChild(script);
        
        console.log('📥 Respuesta:', respuesta);
        
        if (respuesta && respuesta.success === true) {
          resolve(respuesta.data || respuesta);
        } else {
          reject(new Error(respuesta?.error || 'Error en la petición'));
        }
      };
      
      const script = document.createElement('script');
      script.src = url;
      script.onerror = () => {
        delete window[callbackName];
        reject(new Error('Error de conexión'));
      };
      document.body.appendChild(script);
    });
  },

  async login(email, password) {
    try {
      const resultado = await this.peticionJSONP('LOGIN', { email, password });
      console.log('Login exitoso:', resultado);
      
      if (resultado && resultado.api_key) {
        this.apiKey = resultado.api_key;
        localStorage.setItem('api_key', resultado.api_key);
      }
      if (resultado && resultado.usuario) {
        localStorage.setItem('usuario', JSON.stringify(resultado.usuario));
      }
      
      // Disparar evento de actualización
      window.dispatchEvent(new CustomEvent('login-status-changed'));
      
      return resultado;
    } catch (error) {
      console.error('Error login:', error);
      throw error;
    }
  },

  async listar(coleccion) {
    const resultado = await this.peticionJSONP('LISTAR', { coleccion });
    return resultado;
  },

  async crear(coleccion, datos) {
    return this.peticionJSONP('CREAR', { coleccion, datos });
  },

  async actualizar(coleccion, id, datos) {
    return this.peticionJSONP('ACTUALIZAR', { coleccion, id, datos });
  },

  async eliminar(coleccion, id) {
    return this.peticionJSONP('ELIMINAR', { coleccion, id });
  },

  cerrarSesion() {
    this.apiKey = null;
    localStorage.removeItem('usuario');
    localStorage.removeItem('api_key');
    window.dispatchEvent(new CustomEvent('login-status-changed'));
    window.location.href = '/avisos-jardines/login.html';
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

// Evento de API lista
window.dispatchEvent(new CustomEvent('api-ready'));
console.log('✅ API lista');