// ==================== API CLIENT CON JSONP ====================
const API = {
  baseUrl: 'https://script.google.com/macros/s/AKfycbypdJs688Nr4O3N52_SdSza_yXzZ6_s_gwxU5dkZirITernyDleWz5HI88cvWt09XYZ/exec',

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
        if (document.body.contains(script)) document.body.removeChild(script);
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

  // Método genérico para cualquier petición
  async peticion(accion, datos = {}) {
    try {
      const resultado = await this.peticionJSONP(accion, datos);
      return resultado;
    } catch(error) {
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
    } catch(error) {
      console.error('Error en listar:', error);
      this.mostrarError('Error al cargar datos: ' + error.message);
      throw error;
    }
  },

  // Crear un nuevo registro
  async crear(coleccion, datos) {
    try {
      const resultado = await this.peticionJSONP('CREAR', { 
        coleccion, 
        datos 
      });
      return resultado;
    } catch(error) {
      console.error('Error en crear:', error);
      this.mostrarError('Error al crear: ' + error.message);
      throw error;
    }
  },

  // Actualizar un registro
  async actualizar(coleccion, id, datos) {
    try {
      const resultado = await this.peticionJSONP('ACTUALIZAR', { 
        coleccion, 
        id, 
        datos 
      });
      return resultado;
    } catch(error) {
      console.error('Error en actualizar:', error);
      this.mostrarError('Error al actualizar: ' + error.message);
      throw error;
    }
  },

  // Eliminar un registro
  async eliminar(coleccion, id) {
    try {
      const resultado = await this.peticionJSONP('ELIMINAR', { 
        coleccion, 
        id 
      });
      return resultado;
    } catch(error) {
      console.error('Error en eliminar:', error);
      this.mostrarError('Error al eliminar: ' + error.message);
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