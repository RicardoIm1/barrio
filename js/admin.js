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

  // FORMULARIO NUEVO AVISO
  const formAviso = document.getElementById('form-aviso');
  if (formAviso) {
    formAviso.addEventListener('submit', async function (e) {
      e.preventDefault();
      e.stopPropagation(); // Evita que el evento se propague

      console.log('=== INICIO DEL ENVÍO ===');

      // Obtener valores DIRECTAMENTE
      const tituloValue = document.getElementById('titulo').value;
      const contenidoValue = document.getElementById('contenido').value;
      const categoriaValue = document.getElementById('categoria').value;

      console.log('Título capturado:', tituloValue);
      console.log('Título es vacío?', tituloValue === '');
      console.log('Título es null?', tituloValue === null);

      // Validación explícita
      if (!tituloValue || tituloValue.trim() === '') {
        console.error('❌ Título vacío detectado');
        API.mostrarError('El título es obligatorio. Por favor escribe un título.');
        return; // Detener ejecución
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

      // Validar nuevamente después de construir el objeto
      if (!datos.titulo || datos.titulo === '') {
        console.error('❌ Título vacío en el objeto datos');
        API.mostrarError('El título no puede estar vacío');
        return;
      }

      // Continuar con el envío...
      try {
        const resultado = await API.crearAviso(datos, apiKey);
        console.log('Respuesta:', resultado);
        // ... resto del código
      } catch (error) {
        console.error('Error:', error);
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
      const previewContainer = document.getElementById('preview-nuevo');
      if (previewContainer) previewContainer.style.display = 'none';
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

  // Configurar modal de edición
  configurarModalEdicion();

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

      console.log('📝 Enviando edición con API.actualizarAviso:', { id, datos });

      try {
        // Usar el método actualizarAviso que ya existe
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

// Función para convertir URL de YouTube a embed
function getYouTubeEmbedUrl(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
}

// Función para renderizar avisos en grid con tarjeta destacada
function renderizarAvisosGrid(avisos) {
  if (!avisos || avisos.length === 0) {
    return '<div class="mensaje mensaje-info">📭 No hay avisos que coincidan con los filtros</div>';
  }

  // Ordenar por fecha (más reciente primero)
  const avisosOrdenados = [...avisos].sort((a, b) => {
    const fechaA = new Date(a.created_at || 0);
    const fechaB = new Date(b.created_at || 0);
    return fechaB - fechaA;
  });

  let html = '<div class="avisos-grid">';

  avisosOrdenados.forEach((aviso, index) => {
    const esMasReciente = index === 0; // El primero es el más reciente
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

    // Imagen
    let imagenHtml = '';
    if (aviso.imagen_url) {
      imagenHtml = `<img src="${escapeHTML(aviso.imagen_url)}" class="tarjeta-imagen" alt="Imagen" onerror="this.style.display='none'">`;
    }

    // Video
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

async function cargarMisAvisos() {
  console.log('🔍 FUNCIÓN cargarUsuarios EJECUTADA');  // <-- Agrega esto
  console.log('📌 ¿Se encontró el contenedor?', document.getElementById('lista-usuarios-container'));

  const contenedor = document.getElementById('mis-avisos-container');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando">🔄 Cargando avisos...</div>';

  try {
    const usuarioActual = API.getUsuarioActual();
    const esAdmin = usuarioActual && usuarioActual.rol === 'admin';

    // Eliminar filtros anteriores
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

    // Event listeners para filtros de categoría
    document.querySelectorAll('[data-filtro-cat]').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('[data-filtro-cat]').forEach(b => b.classList.remove('activo'));
        this.classList.add('activo');
        filtroCategoriaAdmin = this.dataset.filtroCat;
        paginaAdmin = 1;
        cargarMisAvisos();
      });
    });

    // Event listeners para filtros de estado
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

    // Construir consulta
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

    // Renderizar usando grid
    contenedor.innerHTML = renderizarAvisosGrid(avisos);

    // Paginación
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
  if (!contenedor) {
    console.error('❌ Contenedor lista-usuarios-container no encontrado');
    return;
  }

  contenedor.innerHTML = '<div class="cargando">🔄 Cargando usuarios...</div>';

  try {
    const apiKey = localStorage.getItem('api_key');
    console.log('🔑 Cargando usuarios con API key:', apiKey ? 'Presente' : 'Ausente');

    // Usar la misma estructura que en cargarMisAvisos
    const resultado = await API.listar('USUARIOS', { activo: 'TRUE' });

    console.log('📡 Respuesta completa de API.listar usuarios:', resultado);

    // Extraer los usuarios correctamente (puede estar en datos o directamente en el resultado)
    let usuarios = [];
    if (resultado && resultado.datos) {
      usuarios = resultado.datos;
    } else if (resultado && Array.isArray(resultado)) {
      usuarios = resultado;
    } else if (resultado && resultado.data && resultado.data.datos) {
      usuarios = resultado.data.datos;
    } else if (resultado && resultado.usuarios) {
      usuarios = resultado.usuarios;
    }

    console.log('👥 Usuarios encontrados:', usuarios.length, usuarios);

    if (!usuarios || usuarios.length === 0) {
      contenedor.innerHTML = '<div class="mensaje mensaje-info">👥 No hay usuarios registrados</div>';
      return;
    }

    let html = '<div class="usuarios-grid">';
    usuarios.forEach(user => {
      const rolClass = user.rol === 'admin' ? 'rol-admin' : 'rol-usuario';
      const rolIcon = user.rol === 'admin' ? '👑' : '👤';
      html += `
        <div class="tarjeta-usuario">
          <div class="avatar-usuario">${rolIcon}</div>
          <div class="info-usuario">
            <strong>${escapeHTML(user.nombre || user.email || 'Sin nombre')}</strong>
            <small>${escapeHTML(user.email)}</small>
            <span class="rol-badge ${rolClass}">${user.rol === 'admin' ? 'Administrador' : 'Usuario'}</span>
            <small style="display: block; margin-top: 4px;">🏷️ ${escapeHTML(user.categorias || 'todas')}</small>
            <small style="display: block;">🆔 ID: ${escapeHTML(user.id || 'N/A')}</small>
          </div>
          <button class="boton boton-chico boton-peligro" onclick="eliminarUsuario('${user.id}')" style="padding: 4px 12px;">🗑️</button>
        </div>
      `;
    });
    html += '</div>';

    contenedor.innerHTML = html;
    console.log('✅ Usuarios renderizados correctamente');

  } catch (error) {
    console.error('❌ Error cargando usuarios:', error);
    contenedor.innerHTML = '<div class="mensaje mensaje-error">❌ Error al cargar usuarios: ' + error.message + '</div>';
  }
}

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

async function eliminarUsuario(id) {
  if (!confirm('¿Eliminar este usuario permanentemente?')) return;

  try {
    const apiKey = localStorage.getItem('api_key');
    const resultado = await API.peticion('ELIMINAR', {
      coleccion: 'USUARIOS',
      id: id
    }, apiKey);

    if (resultado && resultado.success) {
      API.mostrarExito('✅ Usuario eliminado correctamente');
      cargarUsuarios();
    } else {
      API.mostrarError('❌ Error: ' + (resultado?.error || 'No se pudo eliminar'));
    }
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
  if (str === undefined || str === null) return '';
  if (typeof str !== 'string') str = String(str);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Función global para abrir editor (sobrescribe la anterior)
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