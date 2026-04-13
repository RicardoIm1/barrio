// ==================== ADMINISTRACIÓN ====================

let paginaAdmin = 1;
let avisosActuales = [];
let filtroCategoriaAdmin = 'todos';

document.addEventListener('DOMContentLoaded', function() {
  console.log('Admin.js cargado correctamente');
  
  // Verificar sesión
  const usuario = API.getUsuarioActual();
  if (!usuario) {
    console.log('No hay sesión activa, redirigiendo a login');
    window.location.href = '/avisos-jardines/login.html';
    return;
  }
  
  console.log('Usuario logueado:', usuario);
  
  // Mostrar pestaña de usuarios solo si es admin
  if (usuario.rol === 'admin') {
    const tabUsuarios = document.getElementById('tab-usuarios-btn');
    if (tabUsuarios) {
      tabUsuarios.style.display = 'inline-block';
      console.log('Pestaña de usuarios visible');
    }
  }
  
  // Configurar tabs
  configurarTabs();
  
  // Formulario nuevo aviso
  const formAviso = document.getElementById('form-aviso');
  if (formAviso) {
    formAviso.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const datos = {
        categoria: document.getElementById('categoria').value,
        titulo: document.getElementById('titulo').value,
        contenido: document.getElementById('contenido').value,
        ubicacion: document.getElementById('ubicacion').value || '',
        contacto: document.getElementById('contacto').value || '',
        fecha_evento: document.getElementById('fecha_evento').value || '',
        destacado: document.getElementById('urgente').checked ? 'TRUE' : 'FALSE',
        status: 'activo',
        usuario_id: usuario.id,
        created_at: new Date().toISOString()
      };
      
      // Validar campos requeridos
      if (!datos.categoria || !datos.titulo || !datos.contenido) {
        API.mostrarError('Completa los campos obligatorios');
        return;
      }
      
      try {
        await API.crear('AVISOS', datos);
        API.mostrarExito('Aviso publicado correctamente');
        formAviso.reset();
        document.getElementById('urgente').checked = false;
        
        // Cambiar a pestaña de lista
        const listaTab = document.querySelector('[data-tab="lista"]');
        if (listaTab) listaTab.click();
        
      } catch(error) {
        API.mostrarError('Error al publicar: ' + error.message);
      }
    });
  }
  
  // Cancelar formulario
  const cancelar = document.getElementById('cancelar');
  if (cancelar) {
    cancelar.addEventListener('click', function() {
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
  
  // Formulario de nuevo usuario (solo admin)
  const formUsuario = document.getElementById('form-usuario');
  if (formUsuario) {
    formUsuario.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const datos = {
        email: document.getElementById('user-email').value,
        nombre: document.getElementById('user-nombre').value,
        rol: document.getElementById('user-rol').value,
        password: document.getElementById('user-password').value,
        categorias: document.getElementById('user-categorias').value || 'todas',
        activo: 'TRUE',
        created_at: new Date().toISOString()
      };
      
      if (!datos.email || !datos.nombre || !datos.password) {
        API.mostrarError('Completa todos los campos');
        return;
      }
      
      try {
        await API.peticion('CREAR_USUARIO', datos);
        API.mostrarExito('Usuario creado correctamente');
        formUsuario.reset();
        cargarUsuarios();
      } catch(error) {
        API.mostrarError('Error al crear usuario: ' + error.message);
      }
    });
  }
  
  // Cargar contenido inicial según la pestaña activa
  const tabActiva = document.querySelector('.tab.activo');
  if (tabActiva && tabActiva.id === 'tab-lista') {
    cargarMisAvisos();
  } else if (tabActiva && tabActiva.id === 'tab-perfil') {
    cargarPerfil();
  } else if (tabActiva && tabActiva.id === 'tab-usuarios') {
    cargarUsuarios();
  }
});

function configurarTabs() {
  const tabs = document.querySelectorAll('[data-tab]');
  console.log('Configurando tabs, encontradas:', tabs.length);
  
  tabs.forEach(btn => {
    btn.addEventListener('click', function(e) {
      console.log('Click en tab:', this.dataset.tab);
      
      // Cambiar clase activa en botones
      tabs.forEach(b => b.classList.remove('activo'));
      this.classList.add('activo');
      
      // Ocultar todas las tabs
      document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('activo');
      });
      
      // Mostrar la tab seleccionada
      const tabId = `tab-${this.dataset.tab}`;
      const tabSeleccionada = document.getElementById(tabId);
      if (tabSeleccionada) {
        tabSeleccionada.classList.add('activo');
        console.log('Mostrando tab:', tabId);
        
        // Cargar contenido según la tab
        if (this.dataset.tab === 'lista') {
          cargarMisAvisos();
        } else if (this.dataset.tab === 'perfil') {
          cargarPerfil();
        } else if (this.dataset.tab === 'usuarios') {
          cargarUsuarios();
        }
      } else {
        console.error('No se encontró la tab:', tabId);
      }
    });
  });
}

async function cargarMisAvisos() {
  console.log('Cargando mis avisos...');
  const contenedor = document.getElementById('mis-avisos-container');
  if (!contenedor) {
    console.error('No se encontró el contenedor mis-avisos-container');
    return;
  }
  
  contenedor.innerHTML = '<div class="cargando">Cargando avisos...</div>';
  
  try {
    // Agregar filtro de categorías si no existe
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
      
      // Agregar event listeners a los filtros de categoría
      document.querySelectorAll('[data-filtro-cat]').forEach(btn => {
        btn.addEventListener('click', function() {
          // Actualizar clase activa
          document.querySelectorAll('[data-filtro-cat]').forEach(b => b.classList.remove('activo'));
          this.classList.add('activo');
          
          filtroCategoriaAdmin = this.dataset.filtroCat;
          paginaAdmin = 1;
          cargarMisAvisos();
        });
      });
    }
    
    // Construir consulta
    let consulta = { status: 'activo' };
    
    // Aplicar filtro de categoría
    if (filtroCategoriaAdmin !== 'todos') {
      consulta.categoria = filtroCategoriaAdmin;
    }
    
    console.log('Consulta aplicada:', consulta);
    
    const resultado = await API.listar('AVISOS', consulta, {
      pagina: paginaAdmin,
      limite: 10
    });
    
    console.log('Resultado de avisos:', resultado);
    
    // Verificar estructura de resultado
    const avisos = resultado.datos || resultado || [];
    const paginacion = resultado.paginacion || { pagina: 1, paginas: 1, total: avisos.length };
    
    if (!avisos || avisos.length === 0) {
      contenedor.innerHTML = '<div class="mensaje mensaje-info">📭 No hay avisos que coincidan con los filtros seleccionados</div>';
      return;
    }
    
    avisosActuales = avisos;
    
    let html = '';
    avisos.forEach(aviso => {
      const fecha = aviso.created_at 
        ? new Date(aviso.created_at).toLocaleDateString('es-MX')
        : 'Fecha no disponible';
      const contenidoPreview = aviso.contenido ? aviso.contenido.substring(0, 100) : '';
      const esUrgente = aviso.destacado === 'TRUE' || aviso.categoria === 'urgente';
      
      html += `
        <div class="tarjeta" style="${esUrgente ? 'border-left: 4px solid #dc3545; background: #fff5f5;' : ''}">
          <div class="tarjeta-titulo">${escapeHTML(aviso.titulo || 'Sin título')} ${esUrgente ? '⚠️' : ''}</div>
          <div class="tarjeta-fecha">📅 ${fecha}</div>
          <div class="tarjeta-contenido">${escapeHTML(contenidoPreview)}${aviso.contenido && aviso.contenido.length > 100 ? '...' : ''}</div>
          <div class="tarjeta-meta">
            <span class="categoria-badge categoria-${aviso.categoria}">🏷️ ${aviso.categoria || 'general'}</span>
          </div>
          <div class="grupo-botones" style="margin-top: 16px;">
            <a href="/avisos-jardines/aviso.html?id=${aviso.id}" class="boton boton-chico" style="width: auto;">👁️ Ver</a>
            <button class="boton boton-chico boton-secundario" onclick="editarAviso('${aviso.id}')">✏️ Editar</button>
            <button class="boton boton-chico boton-secundario" onclick="eliminarAviso('${aviso.id}')">🗑️ Eliminar</button>
          </div>
        </div>
      `;
    });
    
    contenedor.innerHTML = html;
    renderizarPaginacionAdmin(paginacion);
    
  } catch(error) {
    console.error('Error cargando avisos:', error);
    contenedor.innerHTML = '<div class="mensaje mensaje-error">❌ Error al cargar tus avisos: ' + error.message + '</div>';
  }
}

function renderizarPaginacionAdmin(paginacion) {
  const contenedor = document.getElementById('paginacion-admin');
  if (!contenedor) return;
  
  if (!paginacion || paginacion.paginas <= 1) {
    contenedor.innerHTML = '';
    return;
  }
  
  let html = '<div class="paginacion-info">📄 Página ' + paginaAdmin + ' de ' + paginacion.paginas + '</div>';
  html += '<div class="paginacion-botones" style="display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; margin-top: 20px;">';
  
  if (paginaAdmin > 1) {
    html += `<button class="pagina" data-pagina="${paginaAdmin - 1}" style="padding: 8px 12px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">« Anterior</button>`;
  }
  
  for (let i = 1; i <= paginacion.paginas; i++) {
    if (i === 1 || i === paginacion.paginas || (i >= paginaAdmin - 2 && i <= paginaAdmin + 2)) {
      html += `<button class="pagina ${i === paginaAdmin ? 'activa' : ''}" data-pagina="${i}" style="padding: 8px 12px; border: 1px solid ${i === paginaAdmin ? '#007bff' : '#ddd'}; background: ${i === paginaAdmin ? '#007bff' : 'white'}; color: ${i === paginaAdmin ? 'white' : '#333'}; border-radius: 4px; cursor: pointer; min-width: 40px;">${i}</button>`;
    } else if (i === paginaAdmin - 3 || i === paginaAdmin + 3) {
      html += `<span style="padding: 8px 12px;">...</span>`;
    }
  }
  
  if (paginaAdmin < paginacion.paginas) {
    html += `<button class="pagina" data-pagina="${paginaAdmin + 1}" style="padding: 8px 12px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Siguiente »</button>`;
  }
  
  html += '</div>';
  contenedor.innerHTML = html;
  
  contenedor.querySelectorAll('.pagina[data-pagina]').forEach(btn => {
    btn.addEventListener('click', function() {
      paginaAdmin = parseInt(this.dataset.pagina);
      cargarMisAvisos();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

function cargarPerfil() {
  console.log('Cargando perfil...');
  const contenedor = document.getElementById('perfil-info');
  if (!contenedor) {
    console.error('No se encontró el contenedor perfil-info');
    return;
  }
  
  const usuario = API.getUsuarioActual();
  console.log('Usuario para perfil:', usuario);
  
  if (!usuario) {
    contenedor.innerHTML = '<div class="mensaje mensaje-error">No se encontró información del usuario</div>';
    return;
  }
  
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
  console.log('Cargando usuarios...');
  const contenedor = document.getElementById('lista-usuarios-container');
  if (!contenedor) {
    console.error('No se encontró el contenedor lista-usuarios-container');
    return;
  }
  
  contenedor.innerHTML = '<div class="cargando">Cargando usuarios...</div>';
  
  try {
    const resultado = await API.listar('USUARIOS', { activo: 'TRUE' });
    console.log('Usuarios cargados:', resultado);
    
    const usuarios = resultado.datos || resultado || [];
    
    if (!usuarios || usuarios.length === 0) {
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
            <button class="boton boton-chico boton-secundario" onclick="cambiarEstadoUsuario('${user.id}')">🔒 Desactivar</button>
          </div>
        </div>
      `;
    });
    html += '</div>';
    
    contenedor.innerHTML = html;
    
  } catch(error) {
    console.error('Error cargando usuarios:', error);
    contenedor.innerHTML = '<div class="mensaje mensaje-error">❌ Error al cargar usuarios: ' + error.message + '</div>';
  }
}

async function activarNotificaciones() {
  console.log('Activando notificaciones...');
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      API.mostrarExito('🔔 Notificaciones activadas correctamente');
      new Notification('¡Notificaciones activadas!', {
        body: 'Recibirás alertas de nuevos avisos importantes',
        icon: '/avisos-jardines/favicon.ico'
      });
    } else {
      API.mostrarError('❌ No se pudieron activar las notificaciones');
    }
  } else {
    API.mostrarError('❌ Tu navegador no soporta notificaciones');
  }
}

async function cambiarEstadoUsuario(id) {
  console.log('Cambiando estado de usuario:', id);
  if (!confirm('¿Desactivar este usuario?')) return;
  
  try {
    await API.actualizar('USUARIOS', id, { activo: 'FALSE' });
    API.mostrarExito('✅ Usuario desactivado correctamente');
    cargarUsuarios();
  } catch(error) {
    API.mostrarError('Error al actualizar usuario: ' + error.message);
  }
}

async function editarAviso(id) {
  console.log('Editando aviso:', id);
  window.location.href = `/avisos-jardines/aviso.html?id=${id}&editar=true`;
}

async function eliminarAviso(id) {
  if (!confirm('¿Eliminar este aviso permanentemente?')) return;
  
  try {
    await API.eliminar('AVISOS', id);
    API.mostrarExito('✅ Aviso eliminado correctamente');
    cargarMisAvisos();
  } catch(error) {
    API.mostrarError('Error al eliminar: ' + error.message);
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