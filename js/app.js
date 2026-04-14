// ==================== UTILIDADES ====================

function normalizarTelefono(input) {
  if (!input) return null;

  // Convertir a string siempre
  let num = String(input).replace(/\D/g, '');

  if (num.length === 10) return '521' + num;
  if (num.startsWith('52') && num.length === 12) return num;
  if (num.startsWith('521') && num.length === 13) return num;

  return null;
}

function generarLinkWhatsApp(numero, aviso) {
  const mensaje = `Hola, vi tu anuncio (${aviso.id}) de ${aviso.titulo} en Jardines Vallarta. ¿Sigue disponible?`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
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

// ==================== ESTADO ====================

let paginaActual = 1;
let categoriaActual = 'todos';
let todosLosAvisos = [];

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
      filtrarYAplicarPaginacion();
    });
  });
});

// ==================== CARGA DE DATOS ====================

async function cargarAvisos() {
  const contenedor = document.getElementById('avisos-container');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando">Cargando avisos...</div>';

  try {
    const consulta = {};
    if (categoriaActual !== 'todos') {
      consulta.categoria = categoriaActual;
    }

    const resultado = await API.listar('AVISOS', consulta, {
      pagina: paginaActual,
      limite: 12
    });

    if (resultado && resultado.datos) {
      todosLosAvisos = resultado.datos;
      filtrarYAplicarPaginacion();
    } else {
      contenedor.innerHTML = '<div class="mensaje mensaje-info">No hay avisos disponibles</div>';
    }

  } catch (error) {
    console.error('Error cargando avisos:', error);
    contenedor.innerHTML = '<div class="mensaje mensaje-error">Error al cargar avisos: ' + error.message + '</div>';
  }
}

// ==================== FILTRO + PAGINACIÓN ====================

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

// ==================== TARJETA ====================

function crearTarjetaAviso(aviso) {
  const telefono = normalizarTelefono(aviso.contacto || '');

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
  const clicks = aviso.clicks || 0;

  let botonWhatsApp = '';

  if (telefono) {
    const link = generarLinkWhatsApp(telefono, aviso);

    botonWhatsApp = `
      <a href="${link}" 
         target="_blank" 
         class="boton boton-chico"
         onclick="registrarClickWhatsApp('${aviso.id}')"
         style="margin-top: 8px; background:#F9BF24; color:white;">
         📲 Contactar
      </a>
    `;
  }

  return `
    <div class="tarjeta ${claseUrgente}">
      <div class="tarjeta-titulo">${escapeHTML(titulo)}</div>
      <div class="tarjeta-fecha">📅 ${fecha}</div>

      <div class="tarjeta-contenido">
        ${escapeHTML(contenido.substring(0, 150))}
        ${contenido.length > 150 ? '...' : ''}
      </div>

      <div class="tarjeta-meta">
        <span>${categoriaNombre}</span>
        ${aviso.ubicacion ? `<span>📍 ${escapeHTML(aviso.ubicacion)}</span>` : ''}
        <span>👁️ ${clicks} interesados</span>
      </div>

      ${botonWhatsApp}

      <a href="/avisos-jardines/aviso.html?id=${aviso.id}" 
         class="boton boton-chico" 
         style="margin-top: 8px;">
         Ver detalles →
      </a>
    </div>
  `;
}

// ==================== PAGINACIÓN ====================

function renderizarPaginacion(paginacion) {
  const contenedor = document.getElementById('paginacion');
  if (!contenedor) return;

  if (paginacion.paginas <= 1) {
    contenedor.innerHTML = '';
    return;
  }

  let html = '';

  for (let i = 1; i <= paginacion.paginas; i++) {
    if (
      i === 1 ||
      i === paginacion.paginas ||
      (i >= paginaActual - 2 && i <= paginaActual + 2)
    ) {
      html += `<button class="pagina ${i === paginaActual ? 'activa' : ''}" data-pagina="${i}">${i}</button>`;
    } else if (i === paginaActual - 3 || i === paginaActual + 3) {
      html += `<span class="pagina" style="background: none;">...</span>`;
    }
  }

  contenedor.innerHTML = html;

  contenedor.querySelectorAll('.pagina[data-pagina]').forEach(btn => {
    btn.addEventListener('click', function () {
      paginaActual = parseInt(this.dataset.pagina);
      filtrarYAplicarPaginacion();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

// ==================== TRACKING ====================

function registrarClickWhatsApp(idAviso) {
  try {
    fetch("https://script.google.com/macros/s/AKfycbyIubfXTmz9TLNcaAoNPKmgn26xAAp-4txiF-HU56bqv0r81eNcfI0362hnVDT9UJ6X/exec", {
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