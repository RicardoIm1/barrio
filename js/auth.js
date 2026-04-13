// ==================== AUTH ====================

const Auth = {

  // 🔐 Login
  async login(email, password) {
    try {
      const resultado = await API.login(email, password);

      if (resultado && resultado.api_key) {
        return resultado;
      } else {
        throw new Error('Credenciales inválidas');
      }

    } catch (error) {
      console.error('Error en login:', error);
      throw error;
    }
  },

  // 🚪 Logout
  logout() {
    API.logout();
  },

  // 👤 Usuario actual
  getUsuario() {
    return API.getUsuarioActual();
  },

  // 🛡️ Protección de rutas
  requireAuth(redirect = '/avisos-jardines/login.html') {
    const usuario = this.getUsuario();

    if (!usuario) {
      window.location.href = redirect;
      return null;
    }

    return usuario;
  }

};