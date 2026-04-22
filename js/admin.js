// ==================== ADMINISTRACIÓN ====================

let paginaAdmin = 1;
let avisosActuales = [];
let filtroCategoriaAdmin = 'todos';
let filtroStatusAdmin = 'todos';

document.addEventListener('DOMContentLoaded', function () {
  console.log('Admin.js cargado correctamente');

  const usuario = Auth.requireAuth();
  if (!usuario) return;

  console.log('Usuario logueado:', usuario);

  // Mostrar tab de usuarios solo si es admin
  if (usuario.rol === 'admin') {
    const tabUsuarios = document.getElementById('tab-usuarios-btn');
    if (tabUsuarios) {
      tabUsuarios.style.display = 'inline-block';
    }
  }

  configurarTabs();

  // ========== FORMULARIO NUEVO AVISO ==========
  const formAviso = document.getElementById('form-aviso');
  if (formAviso) {
    formAviso.addEventListener('submit', async function (e) {
      e.preventDefault();
      e.stopPropagation();

      console.log('=== INICIO DEL ENVÍO ===');

      const tituloValue = document.getElementById('titulo').value;
      const contenidoValue = document.getElementById('contenido').value;
      const categoriaValue = document.getElementById('categoria').value;

      console.log('Título capturado:', tituloValue);

      if (!tituloValue || tituloValue.trim() === '') {
        console.error('❌ Título vacío detectado');
        API.mostrarError('El título es obligatorio. Por favor escribe un título.');
        return;
      }

      const usuarioActual = API.getUsuarioActual();
      const apiKey = localStorage.getItem('api_key');

      const datos = {
        titulo: tituloValue.trim(),
        contenido: contenidoValue.trim(),
        categoria: categoriaValue,
        ubicacion: document.getElementById('ubicacion')?.value || '',
        contacto: document.getElementById('contacto')?.value || '',
        fecha_evento: document.getElementById('fecha_evento')?.value || '',
        imagen_url: document.getElementById('imagen_url')?.value || '',
        video_url: document.getElementById('video_url')?.value || '',
        destacado: document.getElementById('urgente')?.checked ? 'TRUE' : 'FALSE',
        status: usuarioActual.rol === 'admin' ? 'activo' : 'pendiente',
        created_by: usuarioActual.id,
        created_at: new Date().toISOString()
      };

      console.log('📦 Datos a enviar:', datos);

      try {
        const resultado = await API.crearAviso(datos, apiKey);
        console.log('📡 Respuesta del servidor:', resultado);

        if (resultado && resultado.success) {
          if (usuarioActual.rol !== 'admin') {
            API.mostrarExito('✅ Aviso enviado para revisión. El administrador lo publicará en breve.');
          } else {
            API.mostrarExito('✅ Aviso publicado correctamente');
          }

          formAviso.reset();
          document.getElementById('urgente').checked = false;

          const previewContainer = document.getElementById('preview-nuevo');
          if (previewContainer) previewContainer.style.display = 'none';

          const previewImg = document.getElementById('preview-imagen-nuevo');
          if (previewImg) previewImg.src = '';

          await cargarMisAvisos();

          const listaTab = document.querySelector('[data-tab="lista"]');
          if (listaTab) listaTab.click();
        } else {
          const errorMsg = resultado?.error || 'No se pudo publicar el aviso';
          API.mostrarError('❌ Error: ' + errorMsg);
          console.error('Error del servidor:', resultado);
        }

      } catch (error) {
        console.error('❌ Error al publicar:', error);
        API.mostrarError('Error al publicar: ' + (error.message || 'Error desconocido'));
      }
    });
  }

  // ========== CANCELAR FORMULARIO ==========
  const cancelar = document.getElementById('cancelar');
  if (cancelar) {
    cancelar.addEventListener('click', function () {
      const form = document.getElementById('form-aviso');
      if (form) form.reset();
      document.getElementById('urgente').checked = false;
      const previewContainer = document.getElementById('preview-nuevo');
      if (previewContainer) previewContainer.style.display = 'none';
    });
  }

  // ========== ACTIVAR NOTIFICACIONES ==========
  const btnNotif = document.getElementById('activar-notificaciones');
  if (btnNotif) {
    btnNotif.addEventListener('click', activarNotificaciones);
  }

  // ========== FORMULARIO NUEVO USUARIO ==========
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

  // ========== CONFIGURAR MODAL DE EDICIÓN ==========
  configurarModalEdicion();

  // ========== CARGAR AVISOS INICIALES ==========
  cargarMisAvisos();
});

// ========== CONFIGURAR TABS ==========
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

// ========== CONFIGURAR MODAL EDICIÓN ==========
function configurarModalEdicion() {
  const cerrarModal = document.getElementById('cerrar-modal');
  if (cerrarModal) {
    cerrarModal.addEventListener('click', () => {
      document.getElementById('modal-editar').style.display = 'none';
    });
  }

  const cancelarEditar = document.getElementById('cancelar-editar');
  if (cancelarEditar) {
    cancelarEditar.addEventListener('click', () => {
      document.getElementById('modal-editar').style.display = 'none';
    });
  }

  const modalEditar = document.getElementById('modal-editar');
  if (modalEditar) {
    modalEditar.addEventListener('click', (e) => {
      if (e.target === modalEditar) {
        modalEditar.style.display = 'none';
      }
    });
  }

  const formEditar = document.getElementById('form-editar');
  if (formEditar) {
    formEditar.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = document.getElementById('edit-id').value;
      const apiKey = localStorage.getItem('api_key');

      const datos = {
        titulo: document.getElementById('edit-titulo').value,
        contenido: document.getElementById('edit-contenido').value,
        categoria: document.getElementById('edit-categoria').value,
        ubicacion: document.getElementById('edit-ubicacion').value,
        contacto: document.getElementById('edit-contacto').value,
        fecha_evento: document.getElementById('edit-fecha_evento').value,
        imagen_url: document.getElementById('edit-imagen_url').value,
        video_url: document.getElementById('edit-video_url').value
      };

      console.log('📝 Enviando edición:', { id, datos });

      try {
        const resultado = await API.actualizarAviso(id, datos, apiKey);
        console.log('📡 Respuesta:', resultado);

        if (resultado && resultado.success) {
          API.mostrarExito('✅ Aviso actualizado correctamente');
          document.getElementById('modal-editar').style.display = 'none';
          cargarMisAvisos();
        } else {
          API.mostrarError('❌ Error: ' + (resultado?.error || 'No se pudo actualizar'));
        }
      } catch (error) {
        console.error('Error al actualizar:', error);
        API.mostrarError('❌ Error al actualizar el aviso: ' + error.message);
      }
    });
  }
}

// ========== CONVERTIR URL DE YOUTUBE ==========
function getYouTubeEmbedUrl(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
}

// ========== RENDERIZAR AVISOS EN GRID ==========
function renderizarAvisosGrid(avisos) {
  if (!avisos || avisos.length === 0) {
    return '<div class="mensaje mensaje-info">📭 No hay avisos que coincidan con los filtros</div>';
  }

  const avisosOrdenados = [...avisos].sort((a, b) => {
    const fechaA = new Date(a.created_at || 0);
    const fechaB = new Date(b.created_at || 0);
    return fechaB - fechaA;
  });

  let html = '<div class="avisos-grid">';

  avisosOrdenados.forEach((aviso, index) => {
    const esMasReciente = index === 0;
    const fecha = aviso.created_at
      ? new Date(aviso.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'Fecha no disponible';
    const contenidoPreview = aviso.contenido ? aviso.contenido.substring(0, 150) : '';
    const esUrgente = aviso.destacado === 'TRUE' || aviso.categoria === 'urgente';
    const esPendiente = aviso.status === 'pendiente';
    const esAdmin = API.getUsuarioActual()?.rol === 'admin';

    let cardClass = 'tarjeta';
    if (esMasReciente && !esPendiente) cardClass += ' destacada';

    let cardStyle = '';
    let statusBadge = '';

    if (esPendiente) {
      cardStyle = 'border-left: 4px solid #fbbf24; background: #fffbeb;';
      statusBadge = '<span class="reciente-badge" style="background: #fbbf24; color: #7b2e00;">⏳ Pendiente</span>';
    } else if (esUrgente) {
      cardStyle = 'border-left: 4px solid #dc3545; background: #fff5f5;';
      if (esMasReciente) {
        statusBadge = '<span class="reciente-badge" style="background: #dc3545;">⚠️ URGENTE</span>';
      }
    } else if (esMasReciente) {
      statusBadge = '<span class="reciente-badge">✨ RECIENTE</span>';
    }

    let imagenHtml = '';
    if (aviso.imagen_url) {
      imagenHtml = `<img src="${escapeHTML(aviso.imagen_url)}" class="tarjeta-imagen" alt="Imagen" onerror="this.style.display='none'">`;
    }

    let videoHtml = '';
    const embedUrl = getYouTubeEmbedUrl(aviso.video_url);
    if (embedUrl) {
      videoHtml = `<div class="tarjeta-video"><iframe src="${embedUrl}" frameborder="0" allowfullscreen></iframe></div>`;
    }

    const tituloEdit = encodeURIComponent(aviso.titulo || '');
    const contenidoEdit = encodeURIComponent(aviso.contenido || '');
    const ubicacionEdit = encodeURIComponent(aviso.ubicacion || '');
    const contactoEdit = encodeURIComponent(aviso.contacto || '');
    const imagenEdit = encodeURIComponent(aviso.imagen_url || '');
    const videoEdit = encodeURIComponent(aviso.video_url || '');

    html += `
      <div class="${cardClass}" style="${cardStyle}">
        ${statusBadge}
        ${imagenHtml}
        ${videoHtml}
        <div class="tarjeta-titulo">
          <strong>${escapeHTML(aviso.titulo || 'Sin título')}</strong>
        </div>
        <div class="tarjeta-fecha">📅 ${fecha}</div>
        <div class="tarjeta-contenido">${escapeHTML(contenidoPreview)}${aviso.contenido && aviso.contenido.length > 150 ? '...' : ''}</div>
        <div class="tarjeta-meta">
          <span style="background: #e0e0e0; padding: 4px 8px; border-radius: 4px; font-size: 12px;">🏷️ ${aviso.categoria || 'general'}</span>
          ${aviso.ubicacion ? `<span>📍 ${escapeHTML(aviso.ubicacion)}</span>` : ''}
        </div>
        <div class="grupo-botones">
          <button class="boton boton-chico" onclick="verAviso('${aviso.id}')">👁️ Ver</button>
    `;

    if (esAdmin && esPendiente) {
      html += `
          <button class="boton boton-chico boton-exito" onclick="aprobarAviso('${aviso.id}')">✅ Aprobar</button>
          <button class="boton boton-chico boton-peligro" onclick="rechazarAviso('${aviso.id}')">❌ Rechazar</button>
      `;
    }

    html += `
          <button class="boton boton-chico boton-secundario" onclick="abrirEditor('${aviso.id}', decodeURIComponent('${tituloEdit}'), decodeURIComponent('${contenidoEdit}'), '${aviso.categoria || ''}', decodeURIComponent('${ubicacionEdit}'), decodeURIComponent('${contactoEdit}'), '${aviso.fecha_evento || ''}', decodeURIComponent('${imagenEdit}'), decodeURIComponent('${videoEdit}'))">✏️ Editar</button>
          <button class="boton boton-chico boton-peligro" onclick="eliminarAviso('${aviso.id}')">🗑️ Eliminar</button>
        </div>
      </div>
    `;
  });

  html += '</div>';
  return html;
}

// ========== CARGAR MIS AVISOS ==========
async function cargarMisAvisos() {
  const contenedor = document.getElementById('mis-avisos-container');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando">🔄 Cargando avisos...</div>';

  try {
    const usuarioActual = API.getUsuarioActual();
    const esAdmin = usuarioActual && usuarioActual.rol === 'admin';

    const filtrosCatExistentes = document.querySelector('.filtros-categorias');
    if (filtrosCatExistentes) filtrosCatExistentes.remove();

    const filtrosStatusExistentes = document.querySelector('.filtros-status');
    if (filtrosStatusExistentes) filtrosStatusExistentes.remove();

    let filtrosHTML = `
      <div class="filtros filtros-categorias" style="margin-bottom: 20px; justify-content: flex-start; flex-wrap: wrap;">
        <button class="filtro ${filtroCategoriaAdmin === 'todos' ? 'activo' : ''}" data-filtro-cat="todos">📋 Todos</button>
        <button class="filtro ${filtroCategoriaAdmin === 'urgente' ? 'activo' : ''}" data-filtro-cat="urgente">⚠️ Urgentes</button>
        <button class="filtro ${filtroCategoriaAdmin === 'eventos' ? 'activo' : ''}" data-filtro-cat="eventos">🎉 Eventos</button>
        <button class="filtro ${filtroCategoriaAdmin === 'servicios' ? 'activo' : ''}" data-filtro-cat="servicios">🔧 Servicios</button>
        <button class="filtro ${filtroCategoriaAdmin === 'comercios' ? 'activo' : ''}" data-filtro-cat="comercios">🛒 Comercios</button>
        <button class="filtro ${filtroCategoriaAdmin === 'gobierno' ? 'activo' : ''}" data-filtro-cat="gobierno">🏛️ Gobierno</button>
        <button class="filtro ${filtroCategoriaAdmin === 'varios' ? 'activo' : ''}" data-filtro-cat="varios">📢 Varios</button>
      </div>
    `;

    if (esAdmin) {
      filtrosHTML += `
        <div class="filtros filtros-status" style="margin-bottom: 20px; justify-content: flex-start; flex-wrap: wrap; border-top: 1px solid #ddd; padding-top: 10px;">
          <span style="margin-right: 10px; font-weight: bold;">📌 Estado:</span>
          <button class="filtro ${filtroStatusAdmin === 'todos' ? 'activo' : ''}" data-filtro-status="todos">📋 Todos</button>
          <button class="filtro ${filtroStatusAdmin === 'pendiente' ? 'activo' : ''}" data-filtro-status="pendiente">⏳ Pendientes</button>
          <button class="filtro ${filtroStatusAdmin === 'activo' ? 'activo' : ''}" data-filtro-status="activo">✅ Publicados</button>
        </div>
      `;
    }

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

    if (esAdmin) {
      document.querySelectorAll('[data-filtro-status]').forEach(btn => {
        btn.addEventListener('click', function () {
          document.querySelectorAll('[data-filtro-status]').forEach(b => b.classList.remove('activo'));
          this.classList.add('activo');
          filtroStatusAdmin = this.dataset.filtroStatus;
          paginaAdmin = 1;
          cargarMisAvisos();
        });
      });
    }

    let consulta = {};
    if (filtroCategoriaAdmin !== 'todos') {
      consulta.categoria = filtroCategoriaAdmin;
    }
    if (esAdmin && filtroStatusAdmin !== 'todos') {
      consulta.status = filtroStatusAdmin;
    } else if (!esAdmin) {
      consulta.status = 'activo';
    }

    const resultado = await API.listar('AVISOS', consulta, {
      pagina: paginaAdmin,
      limite: 20
    });

    const avisos = resultado.datos || [];
    const paginacion = resultado.paginacion || { pagina: 1, paginas: 1, total: 0 };

    console.log('📋 Avisos cargados:', avisos.length);

    contenedor.innerHTML = renderizarAvisosGrid(avisos);

    if (paginacion.paginas > 1) {
      let pagHtml = '<div class="paginacion-botones">';
      if (paginaAdmin > 1) {
        pagHtml += `<button class="pagina" data-pagina="${paginaAdmin - 1}">« Anterior</button>`;
      }
      for (let i = 1; i <= paginacion.paginas; i++) {
        if (i === 1 || i === paginacion.paginas || (i >= paginaAdmin - 2 && i <= paginaAdmin + 2)) {
          pagHtml += `<button class="pagina ${i === paginaAdmin ? 'activa' : ''}" data-pagina="${i}">${i}</button>`;
        } else if (i === paginaAdmin - 3 || i === paginaAdmin + 3) {
          pagHtml += `<span>...</span>`;
        }
      }
      if (paginaAdmin < paginacion.paginas) {
        pagHtml += `<button class="pagina" data-pagina="${paginaAdmin + 1}">Siguiente »</button>`;
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
    } else {
      const pagContainer = document.getElementById('paginacion-admin');
      if (pagContainer) pagContainer.innerHTML = '';
    }

  } catch (error) {
    console.error('Error cargando avisos:', error);
    contenedor.innerHTML = '<div class="mensaje mensaje-error">❌ Error al cargar avisos: ' + error.message + '</div>';
  }
}

// ========== APROBAR AVISO ==========
async function aprobarAviso(id) {
  if (!confirm('¿Aprobar este aviso? Se publicará automáticamente en la página principal.')) return;

  try {
    const apiKey = localStorage.getItem('api_key');
    const resultado = await API.peticion('APROBAR_AVISO', { id: id }, apiKey);
    console.log('Resultado aprobar:', resultado);
    API.mostrarExito('✅ Aviso aprobado y publicado correctamente');
    cargarMisAvisos();
  } catch (error) {
    console.error('Error al aprobar:', error);
    API.mostrarError('Error al aprobar: ' + error.message);
  }
}

// ========== RECHAZAR AVISO ==========
async function rechazarAviso(id) {
  if (!confirm('¿Rechazar este aviso? El usuario será notificado y el aviso no se publicará.')) return;

  try {
    const apiKey = localStorage.getItem('api_key');
    const resultado = await API.peticion('RECHAZAR_AVISO', { id: id }, apiKey);
    console.log('Resultado rechazar:', resultado);
    API.mostrarExito('❌ Aviso rechazado');
    cargarMisAvisos();
  } catch (error) {
    console.error('Error al rechazar:', error);
    API.mostrarError('Error al rechazar: ' + error.message);
  }
}

// ========== VER AVISO ==========
function verAviso(id) {
  window.location.href = `/avisos-jardines/aviso.html?id=${id}`;
}

// ========== CARGAR PERFIL ==========
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

// ========== CARGAR USUARIOS ==========
async function cargarUsuarios() {
  const contenedor = document.getElementById('lista-usuarios-container');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando">🔄 Cargando usuarios...</div>';

  try {
    const apiKey = localStorage.getItem('api_key');
    const resultado = await API.listar('USUARIOS', { activo: 'TRUE' });

    console.log('Respuesta usuarios:', resultado);

    let usuarios = resultado.datos || [];

    if (usuarios.length === 0) {
      contenedor.innerHTML = '<div class="mensaje">👥 No hay usuarios registrados</div>';
      return;
    }

    let html = '<div class="usuarios-grid">';
    usuarios.forEach(user => {
      html += `
        <div class="tarjeta-usuario">
          <div class="avatar-usuario">${user.rol === 'admin' ? '👑' : '👤'}</div>
          <div class="info-usuario">
            <strong>${escapeHTML(user.nombre || user.email)}</strong>
            <small>${escapeHTML(user.email)}</small>
            <span class="rol-badge ${user.rol === 'admin' ? 'rol-admin' : 'rol-usuario'}">${user.rol === 'admin' ? 'Administrador' : 'Usuario'}</span>
            <small>🏷️ ${escapeHTML(user.categorias || 'todas')}</small>
          </div>
          <button class="boton boton-chico boton-peligro" onclick="eliminarUsuario('${user.id}')">🗑️</button>
        </div>
      `;
    });
    html += '</div>';

    contenedor.innerHTML = html;
  } catch (error) {
    console.error('Error cargando usuarios:', error);
    contenedor.innerHTML = '<div class="mensaje-error">❌ Error al cargar usuarios</div>';
  }
}

// ========== ELIMINAR AVISO ==========
async function eliminarAviso(id) {
  if (!confirm('¿Eliminar este aviso permanentemente?')) return;

  try {
    const apiKey = localStorage.getItem('api_key');
    const resultado = await API.eliminar('AVISOS', id, apiKey);

    console.log('Resultado eliminar:', resultado);

    if (resultado && resultado.success) {
      API.mostrarExito('✅ Aviso eliminado correctamente');
      cargarMisAvisos();
    } else {
      API.mostrarError('❌ Error: ' + (resultado?.error || 'No se pudo eliminar'));
    }
  } catch (error) {
    console.error('Error al eliminar:', error);
    API.mostrarError('Error al eliminar: ' + error.message);
  }
}

// ========== ELIMINAR USUARIO ==========
async function eliminarUsuario(id) {
  if (!confirm('¿Eliminar este usuario permanentemente?')) return;

  try {
    const apiKey = localStorage.getItem('api_key');
    const resultado = await API.eliminar('USUARIOS', id, apiKey);

    if (resultado && resultado.success) {
      API.mostrarExito('✅ Usuario eliminado correctamente');
      cargarUsuarios(); // Recargar la lista
    } else {
      API.mostrarError('❌ Error: ' + (resultado?.error || 'No se pudo eliminar'));
    }
  } catch (error) {
    API.mostrarError('Error al eliminar: ' + error.message);
  }
}

// ========== ACTIVAR NOTIFICACIONES ==========
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

// ========== ESCAPE HTML ==========
function escapeHTML(str) {
  if (str === undefined || str === null) return '';
  if (typeof str !== 'string') str = String(str);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ========== ABRIR EDITOR GLOBAL ==========
window.abrirEditor = function (id, titulo, contenido, categoria, ubicacion, contacto, fecha_evento, imagen_url, video_url) {
  console.log('=== ABRIR EDITOR ===', { id, titulo });

  document.getElementById('edit-id').value = id || '';
  document.getElementById('edit-titulo').value = titulo || '';
  document.getElementById('edit-contenido').value = contenido || '';
  document.getElementById('edit-categoria').value = categoria || 'eventos';
  document.getElementById('edit-ubicacion').value = ubicacion || '';
  document.getElementById('edit-contacto').value = contacto || '';
  document.getElementById('edit-fecha_evento').value = fecha_evento || '';
  document.getElementById('edit-imagen_url').value = imagen_url || '';
  document.getElementById('edit-video_url').value = video_url || '';

  const previewContainer = document.getElementById('preview-editar');
  const previewImg = document.getElementById('preview-imagen-editar');
  if (imagen_url && (imagen_url.startsWith('http://') || imagen_url.startsWith('https://'))) {
    previewImg.src = imagen_url;
    previewContainer.style.display = 'block';
  } else {
    previewContainer.style.display = 'none';
  }

  document.getElementById('modal-editar').style.display = 'flex';
};