// ==================== UTILIDADES ====================

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
let avisoComentariosActual = null;
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
    const resultado = await API.listar('AVISOS', {}, { pagina: 1, limite: 100 });

    if (resultado && resultado.datos) {
      todosLosAvisos = resultado.datos.filter(a => a.status === 'activo' || a.status === undefined);
      filtrarYAplicarPaginacion();
    } else {
      contenedor.innerHTML = '<div class="mensaje mensaje-info">📭 No hay avisos disponibles</div>';
    }

  } catch (error) {
    console.error('Error cargando avisos:', error);
    contenedor.innerHTML = '<div class="mensaje mensaje-error">❌ Error al cargar avisos</div>';
  }
}

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

// ==================== ESTADÍSTICAS ====================

async function registrarEstadistica(accion, id) {
  try {
    const apiKey = localStorage.getItem('api_key');
    const resultado = await API.peticion(accion, { id: id }, apiKey);
    console.log(`✅ ${accion} registrado para aviso ${id}`);
    return resultado;
  } catch (error) {
    console.warn(`No se pudo registrar ${accion}:`, error);
    return null;
  }
}

// ==================== COMENTARIOS ====================

let comentariosCache = {};

async function cargarComentarios(avisoId) {
  try {
    const resultado = await API.peticion('LISTAR_COMENTARIOS', { avisoId: avisoId });
    if (resultado.success) {
      comentariosCache[avisoId] = resultado.data || [];
    }
    return comentariosCache[avisoId] || [];
  } catch (error) {
    console.error('Error cargando comentarios:', error);
    return [];
  }
}

async function agregarComentario(avisoId, texto) {
  const usuario = API.getUsuarioActual();
  if (!usuario) {
    alert('Debes iniciar sesión para comentar');
    return false;
  }

  if (!texto.trim()) {
    alert('Escribe un comentario');
    return false;
  }

  try {
    const resultado = await API.peticion('AGREGAR_COMENTARIO', {
      avisoId: avisoId,
      texto: texto.trim(),
      autor: usuario.nombre || usuario.email
    });
    
    if (resultado.success) {
      // Actualizar caché
      if (!comentariosCache[avisoId]) comentariosCache[avisoId] = [];
      comentariosCache[avisoId].unshift({
        id: Date.now(),
        texto: texto.trim(),
        autor: usuario.nombre || usuario.email,
        fecha: new Date().toISOString()
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error agregando comentario:', error);
    alert('Error al enviar comentario');
    return false;
  }
}

function mostrarPanelComentarios(avisoId, avisoTitulo) {
  const panel = document.getElementById('comments-panel');
  if (!panel) {
    console.error('Panel de comentarios no encontrado');
    return;
  }

  avisoComentariosActual = avisoId;
  document.getElementById('comments-title').textContent = `💬 Comentarios: ${escapeHTML(avisoTitulo)}`;
  
  cargarYMostrarComentarios(avisoId);
  panel.classList.add('open');
}

async function cargarYMostrarComentarios(avisoId) {
  const container = document.getElementById('comments-list');
  if (!container) return;

  container.innerHTML = '<div class="cargando" style="padding: 1rem;">Cargando comentarios...</div>';
  
  const comentarios = await cargarComentarios(avisoId);
  
  if (comentarios.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--color-texto-claro);">💬 No hay comentarios aún. ¡Sé el primero!</div>';
    return;
  }
  
  container.innerHTML = comentarios.map(com => `
    <div class="comment-item">
      <div class="comment-author">${escapeHTML(com.autor)}</div>
      <div class="comment-text">${escapeHTML(com.texto)}</div>
      <div class="comment-date">${new Date(com.fecha).toLocaleString('es-MX')}</div>
    </div>
  `).join('');
}

function cerrarPanelComentarios() {
  const panel = document.getElementById('comments-panel');
  if (panel) panel.classList.remove('open');
  avisoComentariosActual = null;
}

async function enviarComentario() {
  const input = document.getElementById('comment-input');
  const texto = input.value;
  
  if (!avisoComentariosActual) return;
  
  const success = await agregarComentario(avisoComentariosActual, texto);
  if (success) {
    input.value = '';
    cargarYMostrarComentarios(avisoComentariosActual);
  }
}

// ==================== RENDERIZADO DE AVISOS ====================

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
    
    // Estadísticas (valores por defecto si no existen)
    const vistas = aviso.vistas || 0;
    const clicksWhatsApp = aviso.clicks_whatsapp || 0;
    const intereses = aviso.intereses || 0;
    
    // Contacto
    let numeroWhatsApp = '';
    let numeroTelefono = '';
    const contactoStr = aviso.contacto ? String(aviso.contacto) : '';
    
    if (contactoStr) {
      const numeros = contactoStr.match(/\d+/g);
      if (numeros && numeros.length > 0) {
        const telefonoLimpio = numeros.join('');
        if (telefonoLimpio.length >= 10) {
          numeroWhatsApp = telefonoLimpio;
          numeroTelefono = telefonoLimpio;
        }
      }
    }
    
    const whatsappText = `Hola, vi tu aviso "${aviso.titulo}" en la plataforma de la colonia. Me interesa más información.`;
    
    // Categoría
    const categoriasMap = {
      'urgente': { nombre: '🚨 URGENTE', color: '#dc3545' },
      'escuelas': { nombre: '🏫 ESCUELAS', color: '#2563eb' },
      'servicios': { nombre: '🛠️ SERVICIOS', color: '#ea580c' },
      'comercios': { nombre: '🛒 COMERCIOS', color: '#059669' },
      'eventos': { nombre: '📅 EVENTOS', color: '#7c3aed' },
      'gobierno': { nombre: '🏛️ GOBIERNO', color: '#4b5563' },
      'varios': { nombre: '📢 VARIOS', color: '#6b7280' }
    };
    
    const categoriaInfo = categoriasMap[aviso.categoria] || { nombre: '📢 AVISO', color: '#6c757d' };
    
    html += `
      <div class="tarjeta aviso-card ${esUrgente ? 'urgente' : ''}" onclick="verAviso('${aviso.id}')">
        <div class="categoria-badge" style="background: ${categoriaInfo.color}; color: white;">
          ${categoriaInfo.nombre}
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
          
          <!-- ESTADÍSTICAS -->
          <div class="aviso-stats">
            <span class="stat-item" title="Veces visto" onclick="event.stopPropagation()">
              👁️ ${vistas}
            </span>
            <span class="stat-item" title="Contactos por WhatsApp" onclick="event.stopPropagation()">
              💬 ${clicksWhatsApp}
            </span>
            <span class="stat-item like-btn" onclick="event.stopPropagation(); registrarInteres('${aviso.id}', this)" title="Me interesa">
              ❤️ ${intereses}
            </span>
            <span class="stat-item" onclick="event.stopPropagation(); mostrarPanelComentarios('${aviso.id}', '${escapeHTML(aviso.titulo)}')" title="Comentarios">
              💬
            </span>
          </div>
        </div>
        
        ${numeroWhatsApp ? `
          <a href="https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(whatsappText)}" 
             class="whatsapp-btn" 
             onclick="event.stopPropagation(); registrarClickWhatsApp('${aviso.id}')"
             title="Contactar por WhatsApp">
            💬
          </a>
        ` : ''}
      </div>
    `;
  });
  
  container.innerHTML = html;
  renderizarPaginacion(pagina, totalPaginas);
}

// ==================== INTERACCIONES ====================

async function registrarClickWhatsApp(id) {
  await registrarEstadistica('REGISTRAR_CLICK_WHATSAPP', id);
  // Recargar avisos para actualizar el contador
  setTimeout(() => cargarAvisos(), 500);
}

async function registrarInteres(id, btnElement) {
  const resultado = await registrarEstadistica('REGISTRAR_INTERES', id);
  if (resultado && resultado.success) {
    if (btnElement) {
      btnElement.style.transform = 'scale(1.2)';
      setTimeout(() => {
        btnElement.style.transform = 'scale(1)';
      }, 300);
    }
    // Recargar avisos para actualizar el contador
    setTimeout(() => cargarAvisos(), 500);
  }
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
  
  if (paginaActual > 1) {
    html += `<button class="pagina" data-pagina="${paginaActual - 1}">« Anterior</button>`;
  }
  
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
  
  if (paginaActual < totalPaginas) {
    html += `<button class="pagina" data-pagina="${paginaActual + 1}">Siguiente »</button>`;
  }
  
  pagContainer.innerHTML = html;
  
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

// ==================== FUNCIONES GLOBALES ====================

window.verAviso = function(id) {
  window.location.href = `/avisos-jardines/aviso.html?id=${id}`;
};

window.registrarClickWhatsApp = registrarClickWhatsApp;
window.registrarInteres = registrarInteres;
window.mostrarPanelComentarios = mostrarPanelComentarios;
window.cerrarPanelComentarios = cerrarPanelComentarios;
window.enviarComentario = enviarComentario;