// ==================== ADMINISTRACIÓN ====================

let paginaAdmin = 1;
let avisosActuales = [];

document.addEventListener('DOMContentLoaded', function() {
  // Verificar sesión
  const usuario = API.getUsuarioActual();
  if (!usuario) {
    window.location.href = '/avisos-jardines/login.html';
    return;
  }
  
  // Mostrar pestaña de usuarios solo si es admin
  if (usuario.rol === 'admin') {
    const tabUsuarios = document.getElementById('tab-usuarios-btn');
    if (tabUsuarios) {
      tabUsuarios.style.display = 'inline-block';
    }
  }
  
  // Configurar tabs
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('activo'));
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('activo'));
      
      this.classList.add('activo');
      const tabId = document.getElementById(`tab-${this.dataset.tab}`);
      if (tabId) tabId.classList.add('activo');
      
      if (this.dataset.tab === 'lista') {
        cargarMisAvisos();
      } else if (this.dataset.tab === 'perfil') {
        cargarPerfil();
      } else if (this.dataset.tab === 'usuarios') {
        cargarUsuarios();
      }
    });
  });
  
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
        status: 'activo'
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
        activo: 'TRUE'
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
});

async function cargarMisAvisos() {
  const contenedor = document.getElementById('mis-avisos-container');
  if (!contenedor) return;
  
  contenedor.innerHTML = '<div class="cargando">Cargando avisos...</div>';
  
  try {
    const resultado = await API.listar('AVISOS', { status: 'activo' }, {
      pagina: paginaAdmin,
      limite: 10
    });
    
    if (!resultado || !resultado.datos || resultado.datos.length === 0) {
      contenedor.innerHTML = '<div class="mensaje mensaje-info">No has publicado avisos</div>';
      return;
    }
    
    avisosActuales = resultado.datos;
    
    let html = '';
    resultado.datos.forEach(aviso => {
      const fecha = aviso.created_at 
        ? new Date(aviso.created_at).toLocaleDateString()
        : 'Fecha no disponible';
      const contenidoPreview = aviso.contenido ? aviso.contenido.substring(0, 100) : '';
      
      html += `
        <div class="tarjeta">
          <div class="tarjeta-titulo">${escapeHTML(aviso.titulo || 'Sin título')}</div>
          <div class="tarjeta-fecha">📅 ${fecha}</div>
          <div class="tarjeta-contenido">${escapeHTML(contenidoPreview)}...</div>
          <div class="tarjeta-meta">
            <span>${aviso.categoria || 'general'}</span>
          </div>
          <div class="grupo-botones" style="margin-top: 16px;">
            <a href="/avisos-jardines/aviso.html?id=${aviso.id}" class="boton boton-chico" style="width: auto;">Ver</a>
            <button class="boton boton-chico boton-secundario" onclick="editarAviso('${aviso.id}')">Editar</button>
            <button class="boton boton-chico boton-secundario" onclick="eliminarAviso('${aviso.id}')">Eliminar</button>
          </div>
        </div>
      `;
    });
    
    contenedor.innerHTML = html;
    renderizarPaginacionAdmin(resultado.paginacion);
    
  } catch(error) {
    console.error('Error cargando avisos:', error);
    contenedor.innerHTML = '<div class="mensaje mensaje-error">Error al cargar tus avisos</div>';
  }
}

function renderizarPaginacionAdmin(paginacion) {
  const contenedor = document.getElementById('paginacion-admin');
  if (!contenedor) return;
  
  if (!paginacion || paginacion.paginas <= 1) {
    contenedor.innerHTML = '';
    return;
  }
  
  let html = '';
  for (let i = 1; i <= paginacion.paginas; i++) {
    if (i === 1 || i === paginacion.paginas || (i >= paginaAdmin - 2 && i <= paginaAdmin + 2)) {
      html += `<button class="pagina ${i === paginaAdmin ? 'activa' : ''}" data-pagina="${i}">${i}</button>`;
    } else if (i === paginaAdmin - 3 || i === paginaAdmin + 3) {
      html += `<span class="pagina" style="background: none;">...</span>`;
    }
  }
  
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
  const contenedor = document.getElementById('perfil-info');
  if (!contenedor) return;
  
  const usuario = API.getUsuarioActual();
  
  contenedor.innerHTML = `
    <div class="campo">
      <label>Nombre</label>
      <div style="padding: 8px 0;">${escapeHTML(usuario.nombre || '—')}</div>
    </div>
    <div class="campo">
      <label>Correo electrónico</label>
      <div style="padding: 8px 0;">${escapeHTML(usuario.email)}</div>
    </div>
    <div class="campo">
      <label>Rol</label>
      <div style="padding: 8px 0;">${escapeHTML(usuario.rol)}</div>
    </div>
    <div class="campo">
      <label>Categorías permitidas</label>
      <div style="padding: 8px 0;">${escapeHTML(usuario.categorias || 'todas')}</div>
    </div>
  `;
}

async function cargarUsuarios() {
  const contenedor = document.getElementById('lista-usuarios-container');
  if (!contenedor) return;
  
  contenedor.innerHTML = '<div class="cargando">Cargando usuarios...</div>';
  
  try {
    const resultado = await API.listar('USUARIOS', { activo: 'TRUE' });
    
    if (!resultado || !resultado.datos || resultado.datos.length === 0) {
      contenedor.innerHTML = '<div class="mensaje mensaje-info">No hay usuarios registrados</div>';
      return;
    }
    
    let html = '<div style="margin-top: 16px;">';
    resultado.datos.forEach(user => {
      html += `
        <div class="tarjeta" style="margin-bottom: 12px;">
          <div><strong>${escapeHTML(user.nombre || 'Sin nombre')}</strong></div>
          <div>📧 ${escapeHTML(user.email)}</div>
          <div>👔 Rol: ${escapeHTML(user.rol)} | 🏷️ Categorías: ${escapeHTML(user.categorias || 'todas')}</div>
        </div>
      `;
    });
    html += '</div>';
    
    contenedor.innerHTML = html;
    
  } catch(error) {
    console.error('Error cargando usuarios:', error);
    contenedor.innerHTML = '<div class="mensaje mensaje-error">Error al cargar usuarios</div>';
  }
}

async function editarAviso(id) {
  window.location.href = `/avisos-jardines/aviso.html?id=${id}&editar=true`;
}

async function eliminarAviso(id) {
  if (!confirm('¿Eliminar este aviso permanentemente?')) return;
  
  try {
    await API.eliminar('AVISOS', id);
    API.mostrarExito('Aviso eliminado correctamente');
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