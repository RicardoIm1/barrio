// ==================== CONFIGURACIÓN ====================
const API = {
  baseUrl: 'https://script.google.com/macros/s/AKfycbzINnCQrPcFUrT4eUZ0M2KjJ4rN3wqA2HeUAGjJlBijP_VlNiiFjH21e4e-tnzdPQs4/exec', // REEMPLAZAR CON TU URL
  
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
  
  // ==================== MÉTODO PRINCIPAL ====================
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
    
    try {
      const respuesta = await fetch(this.baseUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const resultado = await respuesta.json();
      
      if (!resultado.success) {
        throw new Error(resultado.error);
      }
      
      return resultado.data;
      
    } catch(error) {
      console.error('API Error:', error);
      this.mostrarError(error.message);
      throw error;
    }
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
    const resultado = await this.peticion('LOGIN', null, { email, clave });
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
      contenedor.innerHTML = `<div class="mensaje mensaje-error">${mensaje}</div>`;
      setTimeout(() => {
        contenedor.innerHTML = '';
      }, 5000);
    }
  },
  
  mostrarExito(mensaje) {
    const contenedor = document.getElementById('mensaje-container');
    if (contenedor) {
      contenedor.innerHTML = `<div class="mensaje mensaje-exito">${mensaje}</div>`;
      setTimeout(() => {
        contenedor.innerHTML = '';
      }, 5000);
    }
  }
};