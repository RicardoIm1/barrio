// ==================== UI CORE ====================

const UI = {

  async cargarHeader() {
    const container = document.getElementById('header-container');
    if (!container) return;

    try {
      const res = await fetch('/avisos-jardines/common/header.html');
      if (!res.ok) throw new Error('Header no encontrado');

      const html = await res.text();
      container.innerHTML = html;

      this.sincronizarAuth();

    } catch (error) {
      console.error('Error cargando header:', error);
    }
  },

  sincronizarAuth() {
    const usuario = API.getUsuarioActual();

    const loginLink = document.getElementById('login-link');
    const cerrarSesion = document.getElementById('cerrar-sesion');

    if (usuario) {

      if (loginLink) {
        loginLink.textContent = usuario.nombre || 'Mi cuenta';
        loginLink.href = '/avisos-jardines/admin.html';
      }

      if (cerrarSesion) {
        cerrarSesion.style.display = 'inline-block';

        cerrarSesion.onclick = (e) => {
          e.preventDefault();
          API.logout();
          window.location.href = '/avisos-jardines/index.html';
        };
      }

    } else {

      if (loginLink) {
        loginLink.textContent = 'Iniciar sesión';
        loginLink.href = '/avisos-jardines/login.html';
      }

      if (cerrarSesion) {
        cerrarSesion.style.display = 'none';
      }
    }
  }

};