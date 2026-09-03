// ==================== UI CORE ====================

const UI = {

  async cargarHeader() {
    const container = document.getElementById('header-container');
    if (!container) return;

    try {
      const res = await fetch('/common/header.html?v=' + Date.now());
      if (!res.ok) throw new Error('Header no encontrado');

      const html = await res.text();
      container.innerHTML = html;

      // Forzar la ejecución del script del header
      const ejecutarHeader = () => {
        if (typeof window._headerActualizarBotones === 'function') {
          console.log('UI: Ejecutando _headerActualizarBotones');
          window._headerActualizarBotones();
        }
        if (typeof window.actualizarHeaderSesion === 'function') {
          console.log('UI: Ejecutando actualizarHeaderSesion');
          window.actualizarHeaderSesion();
        }
      };

      setTimeout(ejecutarHeader, 50);
      setTimeout(ejecutarHeader, 150);
      setTimeout(ejecutarHeader, 300);

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
  },

  renderizarTablaAdmin(avisos) {
    const tablaCuerpo = document.getElementById('tabla-avisos-cuerpo');
    if (!tablaCuerpo) {
      console.error('No se encontró el contenedor id="tabla-avisos-cuerpo" en el HTML');
      return;
    }

    if (!avisos || avisos.length === 0) {
      tablaCuerpo.innerHTML = `<tr><td colspan="6" class="text-center">No hay avisos que coincidan con los filtros.</td></tr>`;
      return;
    }

    const usuarioActual = API.getUsuarioActual();
    const esAdmin = usuarioActual && usuarioActual.rol === 'admin';

    tablaCuerpo.innerHTML = avisos.map(aviso => {
      const tieneImagen = aviso.imagen_url && aviso.imagen_url.startsWith('http');
      const celdaImagen = tieneImagen 
        ? `<img src="${aviso.imagen_url}" alt="Aviso" class="admin-preview-img" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">`
        : `<span style="font-size: 1.5rem;" title="Sin imagen">🖼️❌</span>`;

      let badgeClase = 'badge-pendiente';
      if (aviso.status === 'activo' || aviso.status === 'aprobado') badgeClase = 'badge-activo';
      if (aviso.status === 'rechazado') badgeClase = 'badge-rechazado';

      let accionesBotones = '';
      if (esAdmin) {
        if (aviso.status === 'pendiente') {
          accionesBotones = `
            <button class="btn-tabla btn-aprobar" onclick="UI.procesarAprobacion('${aviso.id}', 'aprobar')">Aprobar</button>
            <button class="btn-tabla btn-rechazar" onclick="UI.procesarAprobacion('${aviso.id}', 'rechazar')">Rechazar</button>
          `;
        } else {
          accionesBotones = `<span class="texto-bloqueado">Sin acciones</span>`;
        }
      } else {
        accionesBotones = `<span class="texto-bloqueado">Solo lectura</span>`;
      }

      return `
        <tr id="fila-aviso-${aviso.id}">
          <td>${celdaImagen}</td>
          <td><strong>${aviso.titulo || 'Sin título'}</strong><br><small style="color: #888;">${aviso.categoria}</small></td>
          <td>${aviso.contacto || 'No provisto'}</td>
          <td>${new Date(aviso.created_at).toLocaleDateString('es-MX')}</td>
          <td><span class="badge-status ${badgeClase}">${aviso.status || 'pendiente'}</span></td>
          <td>
            <div class="acciones-tabla-flex">
              ${accionesBotones}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  async procesarAprobacion(id, accion) {
    const apiKey = localStorage.getItem('api_key');
    if (!apiKey) {
      this.mostrarError('Sesión expirada. Por favor vuelve a iniciar sesión.');
      return;
    }

    try {
      this.mostrarInfo('Procesando solicitud...');
      let resultado;

      if (accion === 'aprobar') {
        resultado = await API.aprobarAviso(id, apiKey);
      } else {
        resultado = await API.rechazarAviso(id, apiKey);
      }

      if (resultado && resultado.success) {
        this.mostrarExito(`Aviso ${accion === 'aprobar' ? 'aprobado' : 'rechazado'} correctamente.`);
        if (typeof window.cargarMisAvisos === 'function') {
          window.cargarMisAvisos();
        } else if (typeof cargarMisAvisos === 'function') {
          cargarMisAvisos();
        }
      } else {
        this.mostrarError(`Error en servidor: ${resultado?.error || 'No se pudo cambiar el estado.'}`);
      }
    } catch (error) {
      console.error(`Fallo crítico al procesar ${accion}:`, error);
      this.mostrarError('Error de red al intentar procesar la solicitud.');
    }
  }

};

window.UI = UI;
window.mostrarError = (msg) => UI.mostrarError(msg);
window.mostrarExito = (msg) => UI.mostrarExito(msg);

function actualizarHeaderPorSesion() {
  const usuarioStr = localStorage.getItem('usuario');
  const apiKey = localStorage.getItem('api_key');

  const loginLink = document.getElementById('login-link');
  const userArea = document.getElementById('user-area');
  const userNameSpan = document.getElementById('user-name');
  const cerrarBtn = document.getElementById('cerrar-sesion');

  if (!loginLink) {
    setTimeout(actualizarHeaderPorSesion, 200);
    return;
  }

  if (usuarioStr && apiKey) {
    try {
      const usuario = JSON.parse(usuarioStr);
      if (loginLink) loginLink.style.display = 'none';
      if (userArea) userArea.style.display = 'flex';
      if (userNameSpan) {
        userNameSpan.textContent = `👋 ${usuario.nombre || usuario.email || 'Usuario'}`;
        userNameSpan.style.cursor = 'pointer';
        userNameSpan.onclick = () => {
          window.location.href = '/admin.html';
        };
      }

      if (cerrarBtn) {
        const nuevoCerrar = cerrarBtn.cloneNode(true);
        cerrarBtn.parentNode.replaceChild(nuevoCerrar, cerrarBtn);
        nuevoCerrar.addEventListener('click', async function (e) {
          e.preventDefault();
          try {
            if (window.Auth && typeof window.Auth.logout === 'function') {
              await window.Auth.logout();
            } else {
              localStorage.removeItem('usuario');
              localStorage.removeItem('api_key');
            }
          } catch (error) {
            console.error('Error cerrando sesión:', error);
          } finally {
            window.location.href = '/index.html';
          }
        });
      }
    } catch (e) {
      console.error('Error al actualizar header:', e);
    }
  } else {
    if (loginLink) loginLink.style.display = 'inline-flex';
    if (userArea) userArea.style.display = 'none';
  }
}

window.actualizarHeaderPorSesion = actualizarHeaderPorSesion;

(function cargarGraficasAdminSiCorresponde() {
  function cargar() {
    if (!document.getElementById('chartUsuariosDiarios') && !document.getElementById('chartAvisosDiarios')) return;
    if (document.getElementById('admin-graficas-reales')) return;
    const script = document.createElement('script');
    script.id = 'admin-graficas-reales';
    script.src = '/js/admin-graficas.js?v=20260903';
    script.async = true;
    document.head.appendChild(script);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cargar, { once: true });
  } else {
    cargar();
  }
  setTimeout(cargar, 500);
  setTimeout(cargar, 1500);
})();

(function normalizarEstadoPresenciaAdmin() {
  function actualizar() {
    document.querySelectorAll('.online-user-time').forEach(el => {
      el.textContent = '● Conectado';
    });
  }
  function instalar() {
    actualizar();
    const lista = document.getElementById('onlineUsersList');
    if (!lista || lista.dataset.presenciaEstadoObserver === '1') return;
    lista.dataset.presenciaEstadoObserver = '1';
    const observer = new MutationObserver(actualizar);
    observer.observe(lista, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', instalar, { once: true });
  } else {
    instalar();
  }
  setTimeout(instalar, 500);
  setTimeout(instalar, 1500);
})();

// ========== ADMIN UI FAILSAFE ==========
// Mantiene la navegación funcional aunque otro módulo de administración
// tarde en inicializarse o no llegue a instalar sus listeners.
(function instalarNavegacionAdminFailsafe() {
  function instalar() {
    const tabs = document.getElementById('admin-tabs');
    if (!tabs || tabs.dataset.adminFailsafe === '1') return !!tabs;

    tabs.dataset.adminFailsafe = '1';

    tabs.addEventListener('click', function (event) {
      const boton = event.target.closest('button.filtro[data-tab]');
      if (!boton || !tabs.contains(boton)) return;

      event.preventDefault();
      event.stopPropagation();

      const nombre = boton.dataset.tab;
      if (!nombre) return;

      tabs.querySelectorAll('.filtro[data-tab]').forEach(b => {
        b.classList.toggle('activo', b === boton);
      });

      document.querySelectorAll('.tab').forEach(panel => {
        panel.classList.toggle('activo', panel.id === 'tab-' + nombre);
      });

      if (nombre === 'perfil' && typeof window.cargarPerfilAdmin === 'function') {
        window.cargarPerfilAdmin();
      }

      if (nombre === 'lista' && typeof window.cargarAvisosParaAdmin === 'function') {
        window.cargarAvisosParaAdmin();
      }

      if (nombre === 'usuarios' && typeof window.cargarUsuarios === 'function') {
        window.cargarUsuarios();
      }
    });

    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', instalar, { once: true });
  } else {
    instalar();
  }
  setTimeout(instalar, 100);
  setTimeout(instalar, 500);
  setTimeout(instalar, 1500);
})();
