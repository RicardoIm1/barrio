// ==================== UTILIDADES ====================

function normalizarTelefono(input) {
  if (!input) return null;
  let num = String(input).replace(/\D/g, '');
  if (num.length === 10) return '521' + num;
  if (num.startsWith('52') && num.length === 12) return num;
  if (num.startsWith('521') && num.length === 13) return num;
  return null;
}

function generarLinkWhatsApp(numero, aviso) {
  const mensaje = `Hola, vi tu anuncio "${aviso.titulo}" en Jardines Vallarta. ¿Me puedes dar más información?`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
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

// ==================== ESTADO ====================

let paginaActual = 1;
let categoriaActual = 'todos';
let todosLosAvisos = [];
let totalPaginas = 1;
const AVISOS_POR_PAGINA = 6;

// ==================== INICIO ====================

document.addEventListener('DOMContentLoaded', function () {
  cargarAvisos();

  const filtros = document.querySelectorAll('.filtro');
  filtros.forEach(btn => {
    btn.addEventListener('click', function () {
      filtros.forEach(b => b.classList.remove('activo'));
      this.classList.add('activo');
      categoriaActual = this.dataset.categoria;
      paginaActual = 1;
      cargarAvisos();
    });
  });
});

// ==================== CARGA DE DATOS ====================

async function cargarAvisos() {
  const contenedor = document.getElementById('avisos-container');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando">📰 Cargando avisos...</div>';

  try {
    const consulta = {};
    if (categoriaActual !== 'todos') {
      consulta.categoria = categoriaActual;
    }

    const resultado = await API.listar('AVISOS', consulta, {
      pagina: 1,
      limite: 100
    });

    if (resultado && resultado.datos) {
      // Solo mostrar avisos activos (no pendientes para usuarios normales)
      todosLosAvisos = resultado.datos.filter(a => a.status === 'activo' || a.status === undefined);
      filtrarYAplicarPaginacion();
    } else {
      contenedor.innerHTML = '<div class="mensaje mensaje-info">📭 No hay avisos disponibles</div>';
    }

  } catch (error) {
    console.error('Error cargando avisos:', error);
    contenedor.innerHTML = '<div class="mensaje mensaje-error">❌ Error al cargar avisos: ' + error.message + '</div>';
  }
}

// ==================== FILTRO + PAGINACIÓN ====================

function filtrarYAplicarPaginacion() {
  let avisosFiltrados = todosLosAvisos;

  if (categoriaActual !== 'todos') {
    avisosFiltrados = todosLosAvisos.filter(a => a.categoria === categoriaActual);
  }

  const inicio = (paginaActual - 1) * AVISOS_POR_PAGINA;
  const avisosPaginados = avisosFiltrados.slice(inicio, inicio + AVISOS_POR_PAGINA);
  totalPaginas = Math.ceil(avisosFiltrados.length / AVISOS_POR_PAGINA);

  renderizarAvisos(avisosPaginados, paginaActual, totalPaginas);
}

// ==================== RENDERIZADO DE AVISOS (VERSIÓN PREMIUM) ====================

function renderizarAvisos(avisos, pagina, totalPaginas) {
  const container = document.getElementById('avisos-container');
  if (!container) return;

  if (!avisos || avisos.length === 0) {
    container.innerHTML = '<div class="cargando">📭 No hay avisos para mostrar</div>';
    renderizarPaginacion(pagina, totalPaginas);
    return;
  }

  let html = '';
  
  avisos.forEach(aviso => {
    const fecha = aviso.created_at 
      ? new Date(aviso.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      : 'Fecha no disponible';
    
    const esUrgente = aviso.destacado === 'TRUE' || aviso.categoria === 'urgente';
    const esPendiente = aviso.status === 'pendiente';
    
    // Limpiar número de teléfono
    let numeroWhatsApp = '';
    let numeroTelefono = '';
    if (aviso.contacto) {
      const numeros = aviso.contacto.match(/\d+/g);
      if (numeros) {
        const telefonoLimpio = numeros.join('');
        if (telefonoLimpio.length >= 10) {
          numeroWhatsApp = telefonoLimpio;
          numeroTelefono = telefonoLimpio;
        }
      }
    }
    
    // Texto para WhatsApp
    const whatsappText = `Hola, vi tu aviso "${aviso.titulo}" en la plataforma de la colonia. Me interesa más información.`;
    
    // Categoría legible
    const categoriaNombre = {
      'urgente': '⚠️ URGENTE',
      'eventos': '🎉 EVENTO',
      'servicios': '🔧 SERVICIO',
      'perdidos': '🔍 PERDIDO',
      'clasificados': '💰 CLASIFICADO'
    }[aviso.categoria] || aviso.categoria || '📢 AVISO';
    
    const categoriaColor = {
      'urgente': '#dc3545',
      'eventos': '#28a745',
      'servicios': '#17a2b8',
      'perdidos': '#ffc107',
      'clasificados': '#6c757d'
    }[aviso.categoria] || '#6c757d';
    
    html += `
      <div class="tarjeta aviso-card ${esUrgente ? 'urgente' : ''} ${esPendiente ? 'pendiente' : ''}" onclick="verAviso('${aviso.id}')">
        ${esPendiente ? '<div class="pendiente-badge">⏳ Pendiente</div>' : ''}
        <div class="categoria-badge" style="background: ${categoriaColor}; color: white;">
          ${categoriaNombre}
        </div>
        
        ${aviso.imagen_url ? `<img src="${aviso.imagen_url}" alt="${aviso.titulo}" class="aviso-imagen" loading="lazy">` : ''}
        
        <div style="padding: 1rem;">
          <h3 class="tarjeta-titulo">${escapeHTML(aviso.titulo || 'Sin título')}</h3>
          
          <div class="aviso-fecha">
            <span>📅</span> ${fecha}
          </div>
          
          <div class="aviso-contenido-preview">
            ${escapeHTML(aviso.contenido ? aviso.contenido.substring(0, 120) : 'Sin contenido')}${aviso.contenido && aviso.contenido.length > 120 ? '...' : ''}
          </div>
          
          <div class="aviso-footer">
            <span>📍 ${escapeHTML(aviso.ubicacion || 'Colonia Jardines')}</span>
          </div>
        </div>
        
        ${numeroWhatsApp ? `
          <a href="https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(whatsappText)}" 
             class="whatsapp-btn" 
             onclick="event.stopPropagation(); abrirWhatsApp('${numeroWhatsApp}', '${whatsappText}', event)"
             title="Contactar por WhatsApp">
            💬
          </a>
        ` : ''}
        
        ${numeroTelefono && !numeroWhatsApp ? `
          <a href="tel:${numeroTelefono}" 
             class="phone-btn" 
             onclick="event.stopPropagation(); abrirTelefono('${numeroTelefono}', event)"
             title="Llamar">
            📞
          </a>
        ` : ''}
      </div>
    `;
  });
  
  container.innerHTML = html;
  renderizarPaginacion(pagina, totalPaginas);
}

// ==================== PAGINACIÓN ====================

function renderizarPaginacion(paginaActual, totalPaginas) {
  const pagContainer = document.getElementById('paginacion');
  if (!pagContainer) return;
  
  if (totalPaginas <= 1) {
    pagContainer.innerHTML = '';
    return;
  }
  
  let html = '';
  
  // Anterior
  if (paginaActual > 1) {
    html += `<button class="pagina" data-pagina="${paginaActual - 1}">« Anterior</button>`;
  }
  
  // Números de página
  const inicio = Math.max(1, paginaActual - 2);
  const fin = Math.min(totalPaginas, paginaActual + 2);
  
  if (inicio > 1) {
    html += `<button class="pagina" data-pagina="1">1</button>`;
    if (inicio > 2) html += `<span class="paginacion-puntos">...</span>`;
  }
  
  for (let i = inicio; i <= fin; i++) {
    html += `<button class="pagina ${i === paginaActual ? 'activa' : ''}" data-pagina="${i}">${i}</button>`;
  }
  
  if (fin < totalPaginas) {
    if (fin < totalPaginas - 1) html += `<span class="paginacion-puntos">...</span>`;
    html += `<button class="pagina" data-pagina="${totalPaginas}">${totalPaginas}</button>`;
  }
  
  // Siguiente
  if (paginaActual < totalPaginas) {
    html += `<button class="pagina" data-pagina="${paginaActual + 1}">Siguiente »</button>`;
  }
  
  pagContainer.innerHTML = html;
  
  // Eventos de paginación
  pagContainer.querySelectorAll('.pagina[data-pagina]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pagina = parseInt(btn.dataset.pagina);
      if (!isNaN(pagina)) {
        paginaActual = pagina;
        filtrarYAplicarPaginacion();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });
}

// ==================== FUNCIONES GLOBALES PARA EL INDEX ====================

window.verAviso = function(id) {
  window.location.href = `/avisos-jardines/aviso.html?id=${id}`;
};

window.abrirWhatsApp = function(numero, texto, event) {
  if (event) event.stopPropagation();
  const url = `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
  window.open(url, '_blank');
  
  // Registrar el click (opcional)
  try {
    fetch("https://script.google.com/macros/s/AKfycbxs5MreHswFIgRkQhDtCQ_uTqkj1qNd3NT4wYBA-6XhcChEZg4o22ufPJ_YxyOiymc/exec", {
      method: "POST",
      body: JSON.stringify({
        accion: "CLICK_WHATSAPP",
        id: id,
        timestamp: new Date().toISOString()
      })
    });
  } catch (e) {
    console.error("Error registrando click", e);
  }
};

window.abrirTelefono = function(numero, event) {
  if (event) event.stopPropagation();
  window.open(`tel:${numero}`, '_blank');
};

// ==================== TRACKING (opcional) ====================

function registrarClickWhatsApp(idAviso) {
  try {
    fetch("https://script.google.com/macros/s/AKfycbxs5MreHswFIgRkQhDtCQ_uTqkj1qNd3NT4wYBA-6XhcChEZg4o22ufPJ_YxyOiymc/exec", {
      method: "POST",
      body: JSON.stringify({
        accion: "CLICK_WHATSAPP",
        id: idAviso,
        timestamp: new Date().toISOString()
      })
    });
  } catch (e) {
    console.error("Error registrando click", e);
  }
}