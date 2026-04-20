// ==================== UI CORE ====================

const UI = {

  async cargarHeader() {
    const container = document.getElementById('header-container');
    if (!container) return;

    try {
      const res = await fetch('/avisos-jardines/common/header.html?v=' + Date.now());
      if (!res.ok) throw new Error('Header no encontrado');

      const html = await res.text();
      container.innerHTML = html;

      // Esperar a que el DOM se actualice y ejecutar la función del header
      setTimeout(() => {
        if (typeof window._headerActualizarBotones === 'function') {
          window._headerActualizarBotones();
        }
        if (typeof window.actualizarHeaderSesion === 'function') {
          window.actualizarHeaderSesion();
        }
      }, 100);

    } catch (error) {
      console.error('Error cargando header:', error);
    }
  },

  mostrarMensaje(mensaje, tipo = 'info') {
    const container = document.getElementById('mensaje-container');
    if (!container) return;

    const clase = tipo === 'error' ? 'mensaje-error' : (tipo === 'exito' ? 'mensaje-exito' : 'mensaje-info');
    container.innerHTML = `<div class="mensaje ${clase}">${mensaje}</div>`;
    
    setTimeout(() => {
      if (container.innerHTML.includes(mensaje)) {
        container.innerHTML = '';
      }
    }, 5000);
  },

  mostrarError(mensaje) {
    this.mostrarMensaje(mensaje, 'error');
  },

  mostrarExito(mensaje) {
    this.mostrarMensaje(mensaje, 'exito');
  },

  mostrarInfo(mensaje) {
    this.mostrarMensaje(mensaje, 'info');
  }
};

// Exponer funciones globales para compatibilidad
window.UI = UI;
window.mostrarError = (msg) => UI.mostrarError(msg);
window.mostrarExito = (msg) => UI.mostrarExito(msg);