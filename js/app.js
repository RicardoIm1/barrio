// ==================== APLICACIÓN PRINCIPAL ====================

let paginaActual = 1;
let categoriaActual = 'todos';

document.addEventListener('DOMContentLoaded', function() {
  cargarAvisos();
  
  // Configurar filtros
  const filtros = document.querySelectorAll('.filtro');
  filtros.forEach(btn => {
    btn.addEventListener('click', function() {
      // Actualizar clase activa
      filtros.forEach(b => b.classList.remove('activo'));
      this.classList.add('activo');
      
      // Actualizar categoría y recargar
      categoriaActual = this.dataset.categoria;
      paginaActual = 1;
      cargarAvisos();
    });
  });
});

async function cargarAvisos() {
  const contenedor = document.getElementById('avisos-container');
  if (!contenedor) return;
  
  contenedor.innerHTML = '<div class="cargando">Cargando avisos...</div>';
  
  try {
    // Construir consulta con filtro de categoría
    const consulta = { status: 'activo' };
    
    if (categoriaActual !== 'todos') {
      consulta.categoria = categoriaActual;
    }
    
    console.log('Consultando avisos con filtro:', consulta);
    
    const resultado = await API.listar('AVISOS', consulta, {
      pagina: paginaActual,
      limite: 12
    });
    
    console.log('Avisos recibidos:', resultado.datos.length);
    
    if (resultado.datos.length === 0) {
      contenedor.innerHTML = '<div class="mensaje mensaje-info">No hay avisos en esta categoría</div>';
    } else {
      contenedor.innerHTML = resultado.datos.map(aviso => crearTarjetaAviso(aviso)).join('');
    }
    
    renderizarPaginacion(resultado.paginacion);
    
  } catch(error) {
    console.error('Error cargando avisos:', error);
    contenedor.innerHTML = '<div class="mensaje mensaje-error">Error al cargar avisos</div>';
  }
}

function crearTarjetaAviso(aviso) {
  const fecha = aviso.created_at 
    ? new Date(aviso.created_at).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    : 'Fecha no disponible';
  
  const claseUrgente = aviso.categoria === 'urgente' ? 'urgente' : '';
  const titulo = aviso.titulo || 'Sin título';
  const contenido = aviso.contenido || '';
  
  // Obtener nombre de categoría en español
  const nombreCategoria = {
    'urgente': 'Urgente',
    'eventos': 'Eventos',
    'servicios': 'Servicios',
    'perdidos': 'Perdidos',
    'clasificados': 'Clasificados'
  }[aviso.categoria] || aviso.categoria;
  
  return `
    <div class="tarjeta ${claseUrgente}">
      <div class="tarjeta-titulo">${escapeHTML(titulo)}</div>
      <div class="tarjeta-fecha">${fecha}</div>
      <div class="tarjeta-contenido">${escapeHTML(contenido.substring(0, 150))}${contenido.length > 150 ? '...' : ''}</div>
      <div class="tarjeta-meta">
        <span>${nombreCategoria}</span>
        ${aviso.ubicacion ? `<span>📍 ${escapeHTML(aviso.ubicacion)}</span>` : ''}
      </div>
      ${aviso.id ? `<a href="aviso.html?id=${aviso.id}" class="boton boton-chico" style="margin-top: 16px;">Ver completo</a>` : ''}
    </div>
  `;
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

function renderizarPaginacion(paginacion) {
  const contenedor = document.getElementById('paginacion');
  if (!contenedor) return;
  
  if (paginacion.paginas <= 1) {
    contenedor.innerHTML = '';
    return;
  }
  
  let html = '';
  
  for (let i = 1; i <= paginacion.paginas; i++) {
    if (i === 1 || i === paginacion.paginas || 
        (i >= paginaActual - 2 && i <= paginaActual + 2)) {
      html += `<button class="pagina ${i === paginaActual ? 'activa' : ''}" data-pagina="${i}">${i}</button>`;
    } else if (i === paginaActual - 3 || i === paginaActual + 3) {
      html += `<span class="pagina" style="background: none;">...</span>`;
    }
  }
  
  contenedor.innerHTML = html;
  
  contenedor.querySelectorAll('.pagina[data-pagina]').forEach(btn => {
    btn.addEventListener('click', function() {
      paginaActual = parseInt(this.dataset.pagina);
      cargarAvisos();
      window.scrollTo(0, 0);
    });
  });
}