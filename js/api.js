// ==================== API CLIENT ====================
const API = {
  baseUrl: 'https://script.google.com/macros/s/AKfycbxECwunOjLANVkgeIorThDgn9THZ0KIh5QPrVw9Vtl2KXKeWPH3os2GKdOgmw1dodIu/exec',
  // Autenticación
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
    if (!usuario) return null;
    try {
      return JSON.parse(usuario);
    } catch(e) {
      return null;
    }
  },
  
  // Petición usando JSONP (evita CORS)
  async peticion(accion, coleccion = null, datos = {}, id = null, consulta = {}, paginacion = {}) {
    return new Promise((resolve, reject) => {
      const callbackName = 'jsonp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
      
      const payload = {
        accion: accion,
        coleccion: coleccion,
        datos: datos,
        id: id,
        consulta: consulta,
        paginacion: paginacion,
        api_key: this.apiKey
      };
      
      const url = this.baseUrl + '?jsonp=' + encodeURIComponent(JSON.stringify(payload));
      
      window[callbackName] = function(data) {
        delete window[callbackName];
        document.body.removeChild(script);
        if (data && data.success) {
          resolve(data.data);
        } else {
          reject(new Error(data?.error || 'Error en la petición'));
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
  
  // Métodos CRUD
  crear: (coleccion, datos) => API.peticion('CREAR', coleccion, datos),
  leer: (coleccion, id) => API.peticion('LEER', coleccion, {}, id),
  actualizar: (coleccion, id, datos) => API.peticion('ACTUALIZAR', coleccion, datos, id),
  eliminar: (coleccion, id) => API.peticion('ELIMINAR', coleccion, {}, id),
  listar: (coleccion, consulta = {}, paginacion = {}) => 
    API.peticion('LISTAR', coleccion, {}, null, consulta, paginacion),
  
  // Login
  async login(email, password) {
    const resultado = await this.peticion('LOGIN', null, { email, password });
    if (resultado.api_key) {
      this.apiKey = resultado.api_key;
      localStorage.setItem('usuario', JSON.stringify(resultado.usuario));
    }
    return resultado;
  },
  
  logout() {
    this.apiKey = null;
    localStorage.removeItem('usuario');
  },
  
  // Utilidades
  mostrarError(mensaje) {
    const contenedor = document.getElementById('mensaje-container');
    if (contenedor) {
      contenedor.innerHTML = `<div class="mensaje mensaje-error">${mensaje}</div>`;
      setTimeout(() => {
        if (contenedor.innerHTML.includes(mensaje)) contenedor.innerHTML = '';
      }, 5000);
    } else {
      alert(mensaje);
    }
  },
  
  mostrarExito(mensaje) {
    const contenedor = document.getElementById('mensaje-container');
    if (contenedor) {
      contenedor.innerHTML = `<div class="mensaje mensaje-exito">${mensaje}</div>`;
      setTimeout(() => {
        if (contenedor.innerHTML.includes(mensaje)) contenedor.innerHTML = '';
      }, 5000);
    }
  }
};