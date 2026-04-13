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

  // ✅ ¿Hay sesión?
  isLoggedIn() {
    return !!this.getUsuario();
  },

  // 🛡️ Protección básica
  requireAuth(redirect = '/avisos-jardines/login.html') {
    const usuario = this.getUsuario();

    if (!usuario) {
      window.location.href = redirect;
      return null;
    }

    return usuario;
  },

  // 👑 Protección por rol
  requireRole(rol, redirect = '/avisos-jardines/index.html') {
    const usuario = this.requireAuth();

    if (!usuario) return null;

    if (usuario.rol !== rol) {
      window.location.href = redirect;
      return null;
    }

    return usuario;
  }

};