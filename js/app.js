// ==================== APLICACIÓN PRINCIPAL ====================

let paginaActual = 1;
let categoriaActual = 'todos';
let todosLosAvisos = [];

document.addEventListener('DOMContentLoaded', function() {
  cargarAvisos();
  
  // Configurar filtros
  const filtros = document.querySelectorAll('.filtro');
  filtros.forEach(btn => {
    btn.addEventListener('click', function() {
      filtros.forEach(b => b.classList.remove('activo'));
      this.classList.add('activo');
      categoriaActual = this.dataset.categoria;
      paginaActual = 1;
      filtrarYAplicarPaginacion();
    });
  });
});

async function cargarAvisos() {
  const contenedor = document.getElementById('avisos-container');
  if (!contenedor) return;
  
  contenedor.innerHTML = '<div class="cargando">Cargando avisos...</div>';
  
  try {
    const resultado = await API.listar('AVISOS');
    
    if (resultado && resultado.datos) {
      todosLosAvisos = resultado.datos;
      filtrarYAplicarPaginacion();
    } else {
      contenedor.innerHTML = '<div class="mensaje mensaje-info">No hay avisos disponibles</div>';
    }
    
  } catch(error) {
    console.error('Error cargando avisos:', error);
    contenedor.innerHTML = '<div class="mensaje mensaje-error">Error al cargar avisos: ' + error.message + '</div>';
  }
}

function filtrarYAplicarPaginacion() {
  let avisosFiltrados = todosLosAvisos;
  
  if (categoriaActual !== 'todos') {
    avisosFiltrados = todosLosAvisos.filter(a => a.categoria === categoriaActual);
  }
  
  const limite = 6;
  const inicio = (paginaActual - 1) * limite;
  const avisosPaginados = avisosFiltrados.slice(inicio, inicio + limite);
  
  const contenedor = document.getElementById('avisos-container');
  if (avisosFiltrados.length === 0) {
    contenedor.innerHTML = '<div class="mensaje mensaje-info">No hay avisos en esta categoría</div>';
  } else {
    contenedor.innerHTML = avisosPaginados.map(aviso => crearTarjetaAviso(aviso)).join('');
  }
  
  const paginacion = {
    pagina: paginaActual,
    total: avisosFiltrados.length,
    paginas: Math.ceil(avisosFiltrados.length / limite)
  };
  
  renderizarPaginacion(paginacion);
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
  
  const nombresCategoria = {
    'urgente': '⚠️ Urgente',
    'eventos': '🎉 Eventos',
    'servicios': '🛠️ Servicios',
    'perdidos': '🐾 Perdidos',
    'clasificados': '📢 Clasificados'
  };
  
  const categoriaNombre = nombresCategoria[aviso.categoria] || aviso.categoria || 'General';
  
  return `
    <div class="tarjeta ${claseUrgente}">
      <div class="tarjeta-titulo">${escapeHTML(titulo)}</div>
      <div class="tarjeta-fecha">📅 ${fecha}</div>
      <div class="tarjeta-contenido">${escapeHTML(contenido.substring(0, 150))}${contenido.length > 150 ? '...' : ''}</div>
      <div class="tarjeta-meta">
        <span>${categoriaNombre}</span>
        ${aviso.ubicacion ? `<span>📍 ${escapeHTML(aviso.ubicacion)}</span>` : ''}
      </div>
      <a href="/avisos-jardines/aviso.html?id=${aviso.id}" class="boton boton-chico" style="margin-top: 16px;">Ver detalles →</a>
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
    if (i === 1 || i === paginacion.paginas || (i >= paginaActual - 2 && i <= paginaActual + 2)) {
      html += `<button class="pagina ${i === paginaActual ? 'activa' : ''}" data-pagina="${i}">${i}</button>`;
    } else if (i === paginaActual - 3 || i === paginaActual + 3) {
      html += `<span class="pagina" style="background: none;">...</span>`;
    }
  }
  
  contenedor.innerHTML = html;
  
  contenedor.querySelectorAll('.pagina[data-pagina]').forEach(btn => {
    btn.addEventListener('click', function() {
      paginaActual = parseInt(this.dataset.pagina);
      filtrarYAplicarPaginacion();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}