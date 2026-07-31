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
    const raw = localStorage.getItem('usuario');

    try {
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      localStorage.removeItem('usuario');
      return null;
    }
  },

  // ✅ ¿Hay sesión?
  isLoggedIn() {
    return !!this.getUsuario();
  },

  // 🛡️ Protección básica
  requireAuth(redirect = '/login.html') {
    const usuario = this.getUsuario();

    if (!usuario) {
      window.location.href = redirect;
      return null;
    }

    return usuario;
  },

  // 👑 Protección por rol
  requireRole(rol, redirect = '/index.html') {
    const usuario = this.requireAuth();

    if (!usuario) return null;

    if (usuario.rol !== rol) {
      window.location.href = redirect;
      return null;
    }

    return usuario;
  }

};