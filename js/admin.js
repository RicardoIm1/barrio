// ==================== ADMINISTRACIÓN ====================

let paginaAdmin = 1;
let avisosActuales = [];
let filtroCategoriaAdmin = 'todos';
let filtroStatusAdmin = 'todos';
let subiendoImagen = false;

document.addEventListener('DOMContentLoaded', async function () {
  console.log('Admin.js cargado correctamente');

  const usuario = await Auth.requireAuth();
  if (!usuario) return;

  if (usuario.rol !== 'admin' && usuario.rol !== 'usuario') {
    alert('No tienes permisos para acceder al panel de administración.');
    window.location.href = 'index.html';
    return;
  }

  console.log('Usuario logueado:', usuario);

  // Mostrar tab de usuarios solo si es admin
  if (usuario.rol === 'admin') {
    const tabUsuarios = document.getElementById('tab-usuarios-btn');
    if (tabUsuarios) {
      tabUsuarios.style.display = 'inline-block';
    }
  }

  configurarTabs();
  
  // CONFIGURAR FILTROS DEL ADMINISTRADOR
  configurarFiltrosAdmin();

  // ========== FORMULARIO NUEVO AVISO ==========
  const formAviso = document.getElementById('form-aviso');
  if (formAviso) {
    formAviso.addEventListener('submit', async function (e) {
      e.preventDefault();
      e.stopPropagation();
      
      if (subiendoImagen) {
        API.mostrarError('⏳ Espera a que termine de subir la imagen');
        return;
      }

      console.log('=== INICIO DEL ENVÍO ===');

      const tituloValue = document.getElementById('titulo').value;
      const contenidoValue = document.getElementById('contenido').value;
      const categoriaValue = document.getElementById('categoria').value;

      if (!tituloValue || tituloValue.trim() === '') {
        console.error('❌ Título vacío detectado');
        API.mostrarError('El título es obligatorio. Por favor escribe un título.');
        return;
      }

      const usuarioActual = API.getUsuarioActual();
      const apiKey = localStorage.getItem('api_key');

      const inputImagenUrl = document.getElementById('imagen_url');
      let urlFinalImagen = inputImagenUrl ? inputImagenUrl.value.trim() : '';

      const datos = {
        titulo: tituloValue.trim(),
        contenido: contenidoValue.trim(),
        categoria: categoriaValue,
        ubicacion: document.getElementById('ubicacion')?.value || '',
        contacto: document.getElementById('contacto')?.value || '',
        fecha_evento: document.getElementById('fecha_evento')?.value || '',
        imagen_url: urlFinalImagen,
        video_url: document.getElementById('video_url')?.value || '',
        destacado: document.getElementById('urgente')?.checked ? 'TRUE' : 'FALSE',
        status: usuarioActual.rol === 'admin' ? 'activo' : 'pendiente',
        created_by: usuarioActual.id,
        created_at: new Date().toISOString()
      };

      console.log('📦 Datos validados a enviar a Google Sheets:', datos);

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
      if(document.getElementById('urgente')) document.getElementById('urgente').checked = false;
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

      const email = document.getElementById('user-email').value;
      const nombre = document.getElementById('user-nombre').value;
      const rol = document.getElementById('user-rol').value;
      const password = document.getElementById('user-password').value;
      const categorias = document.getElementById('user-categorias').value || 'todas';

      if (!email || !nombre || !password) {
        API.mostrarError('Completa todos los campos obligatorios');
        return;
      }

      if (password.length < 6) {
        API.mostrarError('La contraseña debe tener al menos 6 caracteres');
        return;
      }

      const apiKey = localStorage.getItem('api_key');
      if (!apiKey) {
        API.mostrarError('No hay sesión activa. Inicia sesión nuevamente.');
        return;
      }

      const datos = {
        email: email,
        nombre: nombre,
        rol: rol,
        password_hash: password,
        categorias: categorias,
        activo: 'TRUE'
      };

      console.log('📝 Enviando datos de usuario:', { ...datos, password_hash: '***' });

      try {
        const respuesta = await API.peticion('CREAR', {
          coleccion: 'USUARIOS',
          ...datos
        }, apiKey);

        console.log('📡 Respuesta completa:', respuesta);

        if (respuesta && respuesta.success) {
          API.mostrarExito('✅ Usuario creado correctamente');
          formUsuario.reset();
          cargarUsuarios();
        } else {
          const errorMsg = respuesta?.error || 'Error desconocido al crear usuario';
          API.mostrarError('❌ Error: ' + errorMsg);
          console.error('Error del servidor:', respuesta);
        }

      } catch (error) {
        console.error('❌ Error detallado:', error);
        API.mostrarError('Error al crear usuario: ' + (error.message || 'Error de conexión'));
      }
    });
  }

  // ========== CONFIGURAR MODAL DE EDICIÓN ==========
  configurarModalEdicion();

  // ========== CARGAR AVISOS INICIALES ==========
  cargarMisAvisos();
}); // ← CIERRE DEL DOMContentLoaded

// ========== CONFIGURAR FILTROS ADMIN ==========
function configurarFiltrosAdmin() {
  const selectCategoria = document.getElementById('filtro-categoria-admin');
  const selectStatus = document.getElementById('filtro-status-admin');

  if (selectCategoria) {
    selectCategoria.addEventListener('change', function(e) {
      filtroCategoriaAdmin = e.target.value;
      paginaAdmin = 1;
      cargarMisAvisos();
    });
  }

  if (selectStatus) {
    selectStatus.addEventListener('change', function(e) {
      filtroStatusAdmin = e.target.value;
      paginaAdmin = 1;
      cargarMisAvisos();
    });
  }
}

// ========== CARGAR MIS AVISOS (VERSIÓN CORREGIDA) ==========
async function cargarMisAvisos() {
  try {
    const usuarioActual = API.getUsuarioActual();
    if (!usuarioActual) return;

    const filtros = {};
    
    if (filtroCategoriaAdmin !== 'todos') {
      filtros.categoria = filtroCategoriaAdmin;
    }
    
    if (usuarioActual.rol === 'admin') {
      if (filtroStatusAdmin !== 'todos') {
        filtros.status = filtroStatusAdmin;
      }
    }

    console.log('⚙️ Solicitando lista de avisos con filtros:', filtros);
    
    const respuesta = await API.listar('AVISOS', filtros, { pagina: paginaAdmin, limite: 10 });
    
    if (respuesta && (respuesta.datos || Array.isArray(respuesta))) {
      avisosActuales = respuesta.datos || respuesta;
      if (typeof UI !== 'undefined' && typeof UI.renderizarTablaAdmin === 'function') {
        UI.renderizarTablaAdmin(avisosActuales);
      } else {
        console.warn('⚠️ UI.renderizarTablaAdmin no encontrada');
      }
    }
  } catch (error) {
    console.error('❌ Error al cargar listado de avisos administrativos:', error);
  }
}


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
    const esRechazado = aviso.status === 'rechazado';

    html += `
      <article class="aviso-card ${esMasReciente ? 'mas-reciente' : ''}">
        ${esMasReciente ? '<div class="badge-nuevo">NUEVO</div>' : ''}
        ${esUrgente ? '<div class="badge-urgente">URGENTE</div>' : ''}
        <div class="aviso-card-contenido">
          <div class="aviso-card-meta">
            <span>${escapeHTML(aviso.categoria || 'General')}</span>
            <span>${fecha}</span>
          </div>
          <h3>${escapeHTML(aviso.titulo || 'Sin título')}</h3>
          <p>${escapeHTML(contenidoPreview)}${aviso.contenido && aviso.contenido.length > 150 ? '...' : ''}</p>
          ${esPendiente ? '<div class="estado estado-pendiente">Pendiente</div>' : ''}
          ${esRechazado ? '<div class="estado estado-rechazado">Rechazado</div>' : ''}
        </div>
      </article>`;
  });

  html += '</div>';
  return html;
}

// ========== CARGAR PERFIL ==========
async function cargarPerfil() {
  const usuario = API.getUsuarioActual();
  if (!usuario) return;

  const perfil = document.getElementById('perfil-info');
  if (!perfil) return;

  perfil.innerHTML = `
    <div class="perfil-grid">
      <div><strong>Nombre:</strong> ${escapeHTML(usuario.nombre || 'No disponible')}</div>
      <div><strong>Email:</strong> ${escapeHTML(usuario.email || 'No disponible')}</div>
      <div><strong>Rol:</strong> ${escapeHTML(usuario.rol || 'usuario')}</div>
    </div>`;
}

// ========== CARGAR USUARIOS ==========
async function cargarUsuarios() {
  const apiKey = localStorage.getItem('api_key');
  if (!apiKey) return;

  try {
    const respuesta = await API.listar('USUARIOS', {}, { pagina: 1, limite: 100 });
    const usuarios = respuesta?.datos || respuesta || [];
    const contenedor = document.getElementById('lista-usuarios');
    if (!contenedor) return;

    if (!usuarios.length) {
      contenedor.innerHTML = '<p>No hay usuarios registrados.</p>';
      return;
    }

    contenedor.innerHTML = usuarios.map(usuario => `
      <div class="usuario-item">
        <strong>${escapeHTML(usuario.nombre || 'Sin nombre')}</strong>
        <span>${escapeHTML(usuario.email || '')}</span>
        <span>${escapeHTML(usuario.rol || 'usuario')}</span>
      </div>`).join('');
  } catch (error) {
    console.error('❌ Error al cargar usuarios:', error);
  }
}

// ========== ACTIVAR NOTIFICACIONES ==========
async function activarNotificaciones() {
  if (!('Notification' in window)) {
    API.mostrarError('Este navegador no soporta notificaciones.');
    return;
  }

  try {
    const permiso = await Notification.requestPermission();
    if (permiso === 'granted') {
      API.mostrarExito('Notificaciones activadas correctamente.');
    } else {
      API.mostrarError('No se concedió permiso para las notificaciones.');
    }
  } catch (error) {
    console.error('❌ Error solicitando notificaciones:', error);
  }
}

// ========== ESCAPAR HTML ==========
function escapeHTML(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

// ========== ABRIR EDITOR ==========
window.abrirEditor = function (id) {
  const aviso = avisosActuales.find(a => String(a.id) === String(id));
  if (!aviso) return;

  const modal = document.getElementById('modal-editar');
  if (!modal) return;

  document.getElementById('edit-id').value = aviso.id || '';
  document.getElementById('edit-titulo').value = aviso.titulo || '';
  document.getElementById('edit-contenido').value = aviso.contenido || '';
  document.getElementById('edit-categoria').value = aviso.categoria || '';
  document.getElementById('edit-ubicacion').value = aviso.ubicacion || '';
  document.getElementById('edit-contacto').value = aviso.contacto || '';
  document.getElementById('edit-fecha_evento').value = aviso.fecha_evento || '';
  document.getElementById('edit-imagen_url').value = aviso.imagen_url || '';
  document.getElementById('edit-video_url').value = aviso.video_url || '';

  modal.style.display = 'flex';
};
