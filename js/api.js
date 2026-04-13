// ==================== API CLIENT SIMPLIFICADO ====================
const API = {
  baseUrl: 'https://script.google.com/macros/s/AKfycbxtf48CFd11Dbc8ErnqzNFPv7QNa0Ha23jacYVxJO7LiHnsOTU-WEDDKxiJsH6Fvdxz/exec',
  
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
  
  async peticion(accion, datos = {}) {
    try {
      const payload = {
        accion: accion,
        datos: datos,
        api_key: this.apiKey
      };
      
      console.log('Enviando:', payload);
      
      const respuesta = await fetch(this.baseUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const resultado = await respuesta.json();
      console.log('Respuesta:', resultado);
      
      if (!resultado.success) {
        throw new Error(resultado.error || 'Error en la petición');
      }
      
      return resultado.data;
      
    } catch(error) {
      console.error('Error en peticion:', error);
      throw error;
    }
  },
  
  async login(email, password) {
    const resultado = await this.peticion('LOGIN', { email, password });
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
  
  async listar(coleccion, consulta = {}, paginacion = {}) {
    // Por ahora ignoramos coleccion y usamos datos de prueba
    const resultado = await this.peticion('LISTAR', { coleccion, consulta, paginacion });
    return resultado;
  },
  
  mostrarError(mensaje) {
    const contenedor = document.getElementById('mensaje-container');
    if (contenedor) {
      contenedor.innerHTML = `<div class="mensaje mensaje-error">${mensaje}</div>`;
      setTimeout(() => { contenedor.innerHTML = ''; }, 5000);
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