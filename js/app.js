// ==================== APLICACIÓN PRINCIPAL ====================

let paginaActual = 1;
let categoriaActual = 'todos';

document.addEventListener('DOMContentLoaded', function() {
  cargarAvisos();
  
  // Filtros
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
  
  contenedor.innerHTML = '<div class="cargando">Cargando avisos...</div>';
  
  try {
    const consulta = { status: 'activo' };
    
    if (categoriaActual !== 'todos') {
      consulta.categoria = categoriaActual;
    }
    
    const resultado = await API.listar('AVISOS', consulta, {
      pagina: paginaActual,
      limite: 12
    });
    
    if (resultado.datos.length === 0) {
      contenedor.innerHTML = '<div class="mensaje mensaje-info">No hay avisos en esta categoría</div>';
    } else {
      contenedor.innerHTML = resultado.datos.map(aviso => crearTarjetaAviso(aviso)).join('');
    }
    
    renderizarPaginacion(resultado.paginacion);
    
  } catch(error) {
    contenedor.innerHTML = '<div class="mensaje mensaje-error">Error al cargar avisos</div>';
  }
}

function crearTarjetaAviso(aviso) {
  const fecha = new Date(aviso.created_at).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  
  const claseUrgente = aviso.categoria === 'urgente' ? 'urgente' : '';
  
  return `
    <div class="tarjeta ${claseUrgente}">
      <div class="tarjeta-titulo">${aviso.titulo}</div>
      <div class="tarjeta-fecha">${fecha}</div>
      <div class="tarjeta-contenido">${aviso.contenido.substring(0, 150)}${aviso.contenido.length > 150 ? '...' : ''}</div>
      <div class="tarjeta-meta">
        <span>${aviso.categoria}</span>
        ${aviso.ubicacion ? `<span>📍 ${aviso.ubicacion}</span>` : ''}
      </div>
      <a href="aviso.html?id=${aviso.id}" class="boton boton-chico" style="margin-top: 16px;">Ver completo</a>
    </div>
  `;
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