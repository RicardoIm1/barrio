// ==================== ADMINISTRACIÓN ====================

let paginaAdmin = 1;

document.addEventListener('DOMContentLoaded', function() {
  // Verificar sesión
  const usuario = API.getUsuarioActual();
  if (!usuario) {
    window.location.href = 'login.html';
    return;
  }
  
  // Tabs
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('activo'));
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('activo'));
      
      this.classList.add('activo');
      document.getElementById(`tab-${this.dataset.tab}`).classList.add('activo');
      
      if (this.dataset.tab === 'lista') {
        cargarMisAvisos();
      } else if (this.dataset.tab === 'perfil') {
        cargarPerfil();
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
        ubicacion: document.getElementById('ubicacion').value,
        contacto: document.getElementById('contacto').value,
        fecha_evento: document.getElementById('fecha_evento').value,
        urgente: document.getElementById('urgente').checked,
        status: 'activo'
      };
      
      try {
        await API.crear('AVISOS', datos);
        API.mostrarExito('Aviso publicado correctamente');
        formAviso.reset();
        
        // Cambiar a pestaña de lista
        document.querySelector('[data-tab="lista"]').click();
      } catch(error) {}
    });
  }
  
  // Cancelar
  const cancelar = document.getElementById('cancelar');
  if (cancelar) {
    cancelar.addEventListener('click', function() {
      document.getElementById('form-aviso').reset();
    });
  }
  
  // Activar notificaciones
  const btnNotif = document.getElementById('activar-notificaciones');
  if (btnNotif) {
    btnNotif.addEventListener('click', activarNotificaciones);
  }
});

async function cargarMisAvisos() {
  const contenedor = document.getElementById('mis-avisos-container');
  if (!contenedor) return;
  
  contenedor.innerHTML = '<div class="cargando">Cargando avisos...</div>';
  
  try {
    const usuario = API.getUsuarioActual();
    const resultado = await API.listar('AVISOS', {
      status: 'activo'
    }, {
      pagina: paginaAdmin,
      limite: 10
    });
    
    if (resultado.datos.length === 0) {
      contenedor.innerHTML = '<div class="mensaje mensaje-info">No has publicado avisos</div>';
      return;
    }
    
    let html = '';
    resultado.datos.forEach(aviso => {
      html += `
        <div class="tarjeta">
          <div class="tarjeta-titulo">${aviso.titulo}</div>
          <div class="tarjeta-fecha">${new Date(aviso.created_at).toLocaleDateString()}</div>
          <div class="tarjeta-contenido">${aviso.contenido.substring(0, 100)}...</div>
          <div class="grupo-botones" style="margin-top: 16px;">
            <a href="aviso.html?id=${aviso.id}" class="boton boton-chico" style="width: auto;">Ver</a>
            <button class="boton boton-chico boton-secundario" onclick="editarAviso('${aviso.id}')">Editar</button>
            <button class="boton boton-chico boton-secundario" onclick="eliminarAviso('${aviso.id}')">Eliminar</button>
          </div>
        </div>
      `;
    });
    
    contenedor.innerHTML = html;
    
    // Paginación
    renderizarPaginacionAdmin(resultado.paginacion);
    
  } catch(error) {
    contenedor.innerHTML = '<div class="mensaje mensaje-error">Error al cargar avisos</div>';
  }
}

function renderizarPaginacionAdmin(paginacion) {
  const contenedor = document.getElementById('paginacion-admin');
  if (!contenedor) return;
  
  if (paginacion.paginas <= 1) {
    contenedor.innerHTML = '';
    return;
  }
  
  let html = '';
  for (let i = 1; i <= paginacion.paginas; i++) {
    if (i === 1 || i === paginacion.paginas || 
        (i >= paginaAdmin - 2 && i <= paginaAdmin + 2)) {
      html += `<button class="pagina ${i === paginaAdmin ? 'activa' : ''}" data-pagina="${i}">${i}</button>`;
    }
  }
  
  contenedor.innerHTML = html;
  
  contenedor.querySelectorAll('.pagina').forEach(btn => {
    btn.addEventListener('click', function() {
      paginaAdmin = parseInt(this.dataset.pagina);
      cargarMisAvisos();
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
      <div style="padding: 8px 0;">${usuario.nombre || '—'}</div>
    </div>
    <div class="campo">
      <label>Correo electrónico</label>
      <div style="padding: 8px 0;">${usuario.email}</div>
    </div>
    <div class="campo">
      <label>Rol</label>
      <div style="padding: 8px 0;">${usuario.rol}</div>
    </div>
  `;
}

async function editarAviso(id) {
  // Por simplicidad, redirigir al detalle
  window.location.href = `aviso.html?id=${id}&editar=true`;
}

async function eliminarAviso(id) {
  if (!confirm('¿Eliminar este aviso?')) return;
  
  try {
    await API.eliminar('AVISOS', id);
    API.mostrarExito('Aviso eliminado');
    cargarMisAvisos();
  } catch(error) {}
}