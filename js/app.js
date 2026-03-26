// ==================== APLICACIÓN PRINCIPAL ====================

let paginaActual = 1;
let categoriaActual = 'todos';
let mensajeInfoTimeout = null;

document.addEventListener('DOMContentLoaded', async function() {
  if (mensajeInfoTimeout) clearTimeout(mensajeInfoTimeout);
  
  // Verificar conexión
  const conectado = await API.verificarConexion();
  if (!conectado) {
    const container = document.getElementById('mensaje-container');
    if (container) {
      container.innerHTML = `
        <div class="mensaje mensaje-info">
          🔄 Conectando con el servidor... Si el problema persiste, verifica tu conexión a internet.
        </div>
      `;
      mensajeInfoTimeout = setTimeout(() => {
        if (container.innerHTML && container.innerHTML.includes('Conectando')) {
          container.innerHTML = '';
        }
      }, 5000);
    }
  }
  
  // Verificar autenticación y mostrar botón correspondiente
  const usuario = API.getUsuarioActual();
  const loginLink = document.getElementById('login-link');
  
  if (usuario && loginLink) {
    loginLink.textContent = `👤 ${usuario.nombre}`;
    loginLink.href = '/avisos-jardines/admin.html';
  } else if (loginLink) {
    loginLink.textContent = 'Iniciar sesión';
    loginLink.href = '/avisos-jardines/login.html';
  }
  
  // Cargar avisos
  await cargarAvisos();
  
  // Configurar filtros
  document.querySelectorAll('.filtro').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.filtro').forEach(b => b.classList.remove('activo'));
      this.classList.add('activo');
      
      categoriaActual = this.dataset.categoria;
      paginaActual = 1;
      cargarAvisos();
    });
  });
});

async function cargarAvisos() {
  const contenedor = document.getElementById('avisos-container');
  if (!contenedor) return;
  
  contenedor.innerHTML = '<div class="cargando">📢 Cargando avisos...</div>';
  
  try {
    const consulta = { status: 'activo' };
    
    if (categoriaActual !== 'todos') {
      consulta.categoria = categoriaActual;
    }
    
    // Si no hay API key, no podremos listar avisos
    if (!API.isAuthenticated()) {
      console.warn('No autenticado, mostrando mensaje de login');
      contenedor.innerHTML = `
        <div class="mensaje mensaje-info">
          🔐 Inicia sesión para ver los avisos de la colonia
          <br><br>
          <a href="/avisos-jardines/login.html" class="boton">Iniciar sesión</a>
        </div>
      `;
      return;
    }
    
    const resultado = await API.listar('AVISOS', consulta, {
      pagina: paginaActual,
      limite: 12
    });
    
    if (!resultado || !resultado.datos || resultado.datos.length === 0) {
      contenedor.innerHTML = '<div class="mensaje mensaje-info">📭 No hay avisos en esta categoría</div>';
    } else {
      contenedor.innerHTML = resultado.datos.map(aviso => crearTarjetaAviso(aviso)).join('');
    }
    
    if (resultado && resultado.paginacion) {
      renderizarPaginacion(resultado.paginacion);
    }
    
  } catch(error) {
    console.error('Error al cargar avisos:', error);
    contenedor.innerHTML = `
      <div class="mensaje mensaje-error">
        ❌ Error al cargar avisos. 
        ${error.message === 'NO_AUTENTICADO' ? 'Debes iniciar sesión.' : 'Verifica tu conexión a internet.'}
      </div>
    `;
  }
}

function crearTarjetaAviso(aviso) {
  if (!aviso) return '';
  
  const fecha = aviso.created_at ? new Date(aviso.created_at).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }) : 'Fecha no disponible';
  
  const claseUrgente = aviso.categoria === 'urgente' ? 'urgente' : '';
  const titulo = aviso.titulo || 'Sin título';
  const contenido = aviso.contenido || '';
  const categoria = aviso.categoria || 'general';
  const ubicacion = aviso.ubicacion || '';
  const id = aviso.id || '';
  
  return `
    <div class="tarjeta ${claseUrgente}">
      <div class="tarjeta-titulo">${escapeHTML(titulo)}</div>
      <div class="tarjeta-fecha">📅 ${fecha}</div>
      <div class="tarjeta-contenido">${escapeHTML(contenido.substring(0, 150))}${contenido.length > 150 ? '...' : ''}</div>
      <div class="tarjeta-meta">
        <span>🏷️ ${escapeHTML(categoria)}</span>
        ${ubicacion ? `<span>📍 ${escapeHTML(ubicacion)}</span>` : ''}
      </div>
      ${id ? `<a href="aviso.html?id=${id}" class="boton boton-chico" style="margin-top: 16px;">Ver completo →</a>` : ''}
    </div>
  `;
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderizarPaginacion(paginacion) {
  const contenedor = document.getElementById('paginacion');
  if (!contenedor) return;
  
  if (!paginacion || paginacion.paginas <= 1) {
    contenedor.innerHTML = '';
    return;
  }
  
  let html = '';
  
  for (let i = 1; i <= paginacion.paginas; i++) {
    if (i === 1 || i === paginacion.paginas || 
        (i >= paginaActual - 2 && i <= paginaActual + 2)) {
      html += `<button class="pagina ${i === paginaActual ? 'activa' : ''}" data-pagina="${i}">${i}</button>`;
    } else if (i === paginaActual - 3 || i === paginaActual + 3) {
      html += `<span class="paginacion-puntos" style="padding: 8px 12px; background: none; cursor: default;">...</span>`;
    }
  }
  
  contenedor.innerHTML = html;
  
  contenedor.querySelectorAll('.pagina[data-pagina]').forEach(btn => {
    btn.addEventListener('click', function() {
      paginaActual = parseInt(this.dataset.pagina);
      cargarAvisos();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}