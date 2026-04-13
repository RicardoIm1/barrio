// ==================== ADMINISTRACIÓN ====================

let paginaAdmin = 1;
let avisosActuales = [];
let filtroCategoriaAdmin = 'todos';

document.addEventListener('DOMContentLoaded', function () {
  console.log('Admin.js cargado correctamente');

  const usuario = Auth.requireAuth();
  if (!usuario) return;

  console.log('Usuario logueado:', usuario);

  if (usuario.rol === 'admin') {
    const tabUsuarios = document.getElementById('tab-usuarios-btn');
    if (tabUsuarios) {
      tabUsuarios.style.display = 'inline-block';
    }
  }

  configurarTabs();

  // Cierre de sesión
  const cerrarSesionBtn = document.getElementById('cerrar-sesion');
  if (cerrarSesionBtn) {
    cerrarSesionBtn.addEventListener('click', function (e) {
      e.preventDefault();
      API.cerrarSesion();
      window.location.href = '/avisos-jardines/login.html';
    });
  }

  // FORMULARIO NUEVO AVISO - CORREGIDO con nombres EXACTOS
  const formAviso = document.getElementById('form-aviso');
  if (formAviso) {
    formAviso.addEventListener('submit', async function (e) {
      e.preventDefault();

      const usuarioActual = API.getUsuarioActual();

      // LOS NOMBRES DEBEN COINCIDIR EXACTAMENTE con los encabezados de tu hoja
      const datos = {
        titulo: document.getElementById('titulo').value,
        contenido: document.getElementById('contenido').value,
        categoria: document.getElementById('categoria').value,
        ubicacion: document.getElementById('ubicacion').value || '',
        contacto: document.getElementById('contacto').value || '',
        fecha_evento: document.getElementById('fecha_evento').value || '',
        destacado: document.getElementById('urgente').checked ? 'TRUE' : 'FALSE',
        status: 'activo',
        created_by: usuarioActual.id,
        // Estos se generan automáticamente en el backend
        // id, created_at, updated_at se generan en codigo.gs
      };

      console.log('Enviando aviso con datos:', datos);

      // Validar campos requeridos
      if (!datos.categoria || !datos.titulo || !datos.contenido) {
        API.mostrarError('Completa los campos obligatorios');
        return;
      }

      try {
        const resultado = await API.crear('AVISOS', datos);
        console.log('Respuesta del servidor:', resultado);
        API.mostrarExito('✅ Aviso publicado correctamente');
        formAviso.reset();
        document.getElementById('urgente').checked = false;

        // Cambiar a pestaña de lista
        const listaTab = document.querySelector('[data-tab="lista"]');
        if (listaTab) listaTab.click();

      } catch (error) {
        console.error('Error al publicar:', error);
        API.mostrarError('Error al publicar: ' + error.message);
      }
    });
  }

  // Cancelar formulario
  const cancelar = document.getElementById('cancelar');
  if (cancelar) {
    cancelar.addEventListener('click', function () {
      const form = document.getElementById('form-aviso');
      if (form) form.reset();
      document.getElementById('urgente').checked = false;
    });
  }

  // Activar notificaciones
  const btnNotif = document.getElementById('activar-notificaciones');
  if (btnNotif) {
    btnNotif.addEventListener('click', activarNotificaciones);
  }

  // Formulario de nuevo usuario
  const formUsuario = document.getElementById('form-usuario');
  if (formUsuario) {
    formUsuario.addEventListener('submit', async function (e) {
      e.preventDefault();

      const datos = {
        email: document.getElementById('user-email').value,
        nombre: document.getElementById('user-nombre').value,
        rol: document.getElementById('user-rol').value,
        password_hash: document.getElementById('user-password').value,
        categorias: document.getElementById('user-categorias').value || 'todas',
        activo: 'TRUE'
      };

      if (!datos.email || !datos.nombre || !datos.password_hash) {
        API.mostrarError('Completa todos los campos');
        return;
      }

      try {
        await API.peticion('CREAR_USUARIO', datos);
        API.mostrarExito('✅ Usuario creado correctamente');
        formUsuario.reset();
        cargarUsuarios();
      } catch (error) {
        API.mostrarError('Error al crear usuario: ' + error.message);
      }
    });
  }

  // Cargar avisos iniciales
  cargarMisAvisos();
});

function configurarTabs() {
  const tabs = document.querySelectorAll('[data-tab]');

  tabs.forEach(btn => {
    btn.addEventListener('click', function () {
      tabs.forEach(b => b.classList.remove('activo'));
      this.classList.add('activo');

      document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('activo');
      });

      const tabId = `tab-${this.dataset.tab}`;
      const tabSeleccionada = document.getElementById(tabId);
      if (tabSeleccionada) {
        tabSeleccionada.classList.add('activo');

        if (this.dataset.tab === 'lista') {
          cargarMisAvisos();
        } else if (this.dataset.tab === 'perfil') {
          cargarPerfil();
        } else if (this.dataset.tab === 'usuarios') {
          cargarUsuarios();
        }
      }
    });
  });
}

async function cargarMisAvisos() {
  const contenedor = document.getElementById('mis-avisos-container');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando">🔄 Cargando avisos...</div>';

  try {
    // Agregar filtro de categorías
    if (!document.querySelector('.filtros-categorias')) {
      const filtrosHTML = `
        <div class="filtros filtros-categorias" style="margin-bottom: 20px; justify-content: flex-start; flex-wrap: wrap;">
          <button class="filtro ${filtroCategoriaAdmin === 'todos' ? 'activo' : ''}" data-filtro-cat="todos">📋 Todos</button>
          <button class="filtro ${filtroCategoriaAdmin === 'urgente' ? 'activo' : ''}" data-filtro-cat="urgente">⚠️ Urgentes</button>
          <button class="filtro ${filtroCategoriaAdmin === 'eventos' ? 'activo' : ''}" data-filtro-cat="eventos">🎉 Eventos</button>
          <button class="filtro ${filtroCategoriaAdmin === 'servicios' ? 'activo' : ''}" data-filtro-cat="servicios">🔧 Servicios</button>
          <button class="filtro ${filtroCategoriaAdmin === 'perdidos' ? 'activo' : ''}" data-filtro-cat="perdidos">🔍 Perdidos</button>
          <button class="filtro ${filtroCategoriaAdmin === 'clasificados' ? 'activo' : ''}" data-filtro-cat="clasificados">💰 Clasificados</button>
        </div>
      `;
      contenedor.insertAdjacentHTML('beforebegin', filtrosHTML);

      document.querySelectorAll('[data-filtro-cat]').forEach(btn => {
        btn.addEventListener('click', function () {
          document.querySelectorAll('[data-filtro-cat]').forEach(b => b.classList.remove('activo'));
          this.classList.add('activo');
          filtroCategoriaAdmin = this.dataset.filtroCat;
          paginaAdmin = 1;
          cargarMisAvisos();
        });
      });
    }

    let consulta = { status: 'activo' };
    if (filtroCategoriaAdmin !== 'todos') {
      consulta.categoria = filtroCategoriaAdmin;
    }

    const resultado = await API.listar('AVISOS', consulta, {
      pagina: paginaAdmin,
      limite: 10
    });

    const avisos = resultado.datos || [];
    const paginacion = resultado.paginacion || { pagina: 1, paginas: 1, total: 0 };

    console.log('Avisos cargados:', avisos.length);

    if (avisos.length === 0) {
      contenedor.innerHTML = '<div class="mensaje mensaje-info">📭 No hay avisos que coincidan con los filtros</div>';
      return;
    }

    let html = '';
    avisos.forEach(aviso => {
      const fecha = aviso.created_at
        ? new Date(aviso.created_at).toLocaleDateString('es-MX')
        : 'Fecha no disponible';
      const contenidoPreview = aviso.contenido ? aviso.contenido.substring(0, 100) : '';
      const esUrgente = aviso.destacado === 'TRUE' || aviso.categoria === 'urgente';

      html += `
        <div class="tarjeta" style="${esUrgente ? 'border-left: 4px solid #dc3545; background: #fff5f5;' : ''}">
          <div class="tarjeta-titulo"><strong>${escapeHTML(aviso.titulo || 'Sin título')}</strong> ${esUrgente ? '⚠️' : ''}</div>
          <div class="tarjeta-fecha">📅 ${fecha}</div>
          <div class="tarjeta-contenido">${escapeHTML(contenidoPreview)}${aviso.contenido && aviso.contenido.length > 100 ? '...' : ''}</div>
          <div class="tarjeta-meta">
            <span style="background: #e0e0e0; padding: 4px 8px; border-radius: 4px; font-size: 12px;">🏷️ ${aviso.categoria || 'general'}</span>
            ${aviso.ubicacion ? `<span style="margin-left: 8px;">📍 ${escapeHTML(aviso.ubicacion)}</span>` : ''}
          </div>
          <div class="grupo-botones" style="margin-top: 16px;">
            <button class="boton boton-chico" onclick="verAviso('${aviso.id}')">👁️ Ver</button>
            <button class="boton boton-chico boton-secundario" onclick="editarAviso('${aviso.id}')">✏️ Editar</button>
            <button class="boton boton-chico boton-secundario" onclick="eliminarAviso('${aviso.id}')">🗑️ Eliminar</button>
          </div>
        </div>
      `;
    });

    contenedor.innerHTML = html;

    // Paginación
    if (paginacion.paginas > 1) {
      let pagHtml = '<div class="paginacion-botones" style="display: flex; justify-content: center; gap: 8px; margin-top: 20px; flex-wrap: wrap;">';
      if (paginaAdmin > 1) {
        pagHtml += `<button class="pagina" data-pagina="${paginaAdmin - 1}" style="padding: 8px 12px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">« Anterior</button>`;
      }
      for (let i = 1; i <= paginacion.paginas; i++) {
        if (i === 1 || i === paginacion.paginas || (i >= paginaAdmin - 2 && i <= paginaAdmin + 2)) {
          pagHtml += `<button class="pagina ${i === paginaAdmin ? 'activa' : ''}" data-pagina="${i}" style="padding: 8px 12px; border: 1px solid ${i === paginaAdmin ? '#007bff' : '#ddd'}; background: ${i === paginaAdmin ? '#007bff' : 'white'}; color: ${i === paginaAdmin ? 'white' : '#333'}; border-radius: 4px; cursor: pointer;">${i}</button>`;
        } else if (i === paginaAdmin - 3 || i === paginaAdmin + 3) {
          pagHtml += `<span style="padding: 8px 12px;">...</span>`;
        }
      }
      if (paginaAdmin < paginacion.paginas) {
        pagHtml += `<button class="pagina" data-pagina="${paginaAdmin + 1}" style="padding: 8px 12px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Siguiente »</button>`;
      }
      pagHtml += '</div>';

      const pagContainer = document.getElementById('paginacion-admin');
      if (pagContainer) {
        pagContainer.innerHTML = pagHtml;
        pagContainer.querySelectorAll('.pagina[data-pagina]').forEach(btn => {
          btn.addEventListener('click', function () {
            paginaAdmin = parseInt(this.dataset.pagina);
            cargarMisAvisos();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          });
        });
      }
    }

  } catch (error) {
    console.error('Error cargando avisos:', error);
    contenedor.innerHTML = '<div class="mensaje mensaje-error">❌ Error al cargar avisos: ' + error.message + '</div>';
  }
}

function verAviso(id) {
  window.location.href = `/avisos-jardines/aviso.html?id=${id}`;
}

function cargarPerfil() {
  const contenedor = document.getElementById('perfil-info');
  if (!contenedor) return;

  const usuario = API.getUsuarioActual();

  contenedor.innerHTML = `
    <div class="campo">
      <label>👤 Nombre</label>
      <div style="padding: 8px 0; background: #f5f5f5; border-radius: 4px;">${escapeHTML(usuario.nombre || '—')}</div>
    </div>
    <div class="campo">
      <label>📧 Correo electrónico</label>
      <div style="padding: 8px 0; background: #f5f5f5; border-radius: 4px;">${escapeHTML(usuario.email)}</div>
    </div>
    <div class="campo">
      <label>👔 Rol</label>
      <div style="padding: 8px 0; background: #f5f5f5; border-radius: 4px;">${escapeHTML(usuario.rol)}</div>
    </div>
    <div class="campo">
      <label>🏷️ Categorías permitidas</label>
      <div style="padding: 8px 0; background: #f5f5f5; border-radius: 4px;">${escapeHTML(usuario.categorias || 'todas')}</div>
    </div>
  `;
}

async function cargarUsuarios() {
  const contenedor = document.getElementById('lista-usuarios-container');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando">🔄 Cargando usuarios...</div>';

  try {
    const resultado = await API.listar('USUARIOS', { activo: 'TRUE' });
    const usuarios = resultado.datos || [];

    if (usuarios.length === 0) {
      contenedor.innerHTML = '<div class="mensaje mensaje-info">👥 No hay usuarios registrados</div>';
      return;
    }

    let html = '<div style="margin-top: 16px;">';
    usuarios.forEach(user => {
      html += `
        <div class="tarjeta" style="margin-bottom: 12px;">
          <div><strong>${escapeHTML(user.nombre || 'Sin nombre')}</strong></div>
          <div>📧 ${escapeHTML(user.email)}</div>
          <div>👔 Rol: ${escapeHTML(user.rol)} | 🏷️ Categorías: ${escapeHTML(user.categorias || 'todas')}</div>
          <div class="grupo-botones" style="margin-top: 12px;">
            <button class="boton boton-chico boton-secundario" onclick="eliminarUsuario('${user.id}')">🗑️ Eliminar</button>
          </div>
        </div>
      `;
    });
    html += '</div>';

    contenedor.innerHTML = html;

  } catch (error) {
    console.error('Error cargando usuarios:', error);
    contenedor.innerHTML = '<div class="mensaje mensaje-error">❌ Error al cargar usuarios</div>';
  }
}

async function editarAviso(id) {
  window.location.href = `/avisos-jardines/aviso.html?id=${id}&editar=true`;
}

async function eliminarAviso(id) {
  if (!confirm('¿Eliminar este aviso permanentemente?')) return;

  try {
    const resultado = await API.eliminar('AVISOS', id);
    console.log('Resultado eliminar:', resultado);
    API.mostrarExito('✅ Aviso eliminado correctamente');
    cargarMisAvisos();
  } catch (error) {
    console.error('Error al eliminar:', error);
    API.mostrarError('Error al eliminar: ' + error.message);
  }
}

async function eliminarUsuario(id) {
  if (!confirm('¿Eliminar este usuario permanentemente?')) return;

  try {
    await API.eliminar('USUARIOS', id);
    API.mostrarExito('✅ Usuario eliminado correctamente');
    cargarUsuarios();
  } catch (error) {
    API.mostrarError('Error al eliminar: ' + error.message);
  }
}

async function activarNotificaciones() {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      API.mostrarExito('🔔 Notificaciones activadas correctamente');
    } else {
      API.mostrarExito('ℹ️ Notificaciones no activadas');
    }
  } else {
    API.mostrarError('❌ Tu navegador no soporta notificaciones');
  }
}

function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}