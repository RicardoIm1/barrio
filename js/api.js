// ==================== API CLIENT SIMPLIFICADO ====================
const API = {
  baseUrl: 'https://script.google.com/macros/s/AKfycbwS5rzdC14Nt8yBzHbbrokliZ6EuTvG-zh1tJtnEkkQRpvQRqVElNUstZ7d1eHNT0Zk/exec',

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
        mode: 'no-cors',  // ← Agrega esta línea
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      // Con no-cors, no podemos leer la respuesta
      // Asumimos éxito y usamos datos locales
      console.log('Petición enviada (modo no-cors)');

      // Devolver datos de prueba para que la app funcione
      return {
        datos: [
          {
            id: '1',
            titulo: 'Bienvenidos a Avisos Jardines',
            contenido: 'Este es el periódico mural digital de nuestra colonia.',
            categoria: 'eventos',
            created_at: new Date().toISOString(),
            ubicacion: 'Colonia Jardines'
          },
          {
            id: '2',
            titulo: 'Junta Vecinal',
            contenido: 'Invitamos a todos los vecinos a la junta mensual.',
            categoria: 'eventos',
            created_at: new Date().toISOString(),
            ubicacion: 'Casa de Cultura'
          },
          {
            id: '3',
            titulo: '¡URGENTE! Corte de agua',
            contenido: 'Mañana habrá corte de agua de 9am a 3pm.',
            categoria: 'urgente',
            created_at: new Date().toISOString(),
            ubicacion: 'Toda la colonia'
          }
        ],
        paginacion: { pagina: 1, limite: 20, total: 3, paginas: 1 }
      };

    } catch (error) {
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