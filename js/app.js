// ==================== APLICACIÓN PRINCIPAL ====================

let paginaActual = 1;
let categoriaActual = 'todos';

document.addEventListener('DOMContentLoaded', async function () {
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

  // ✅ Cargar avisos públicos directamente desde la hoja publicada
  await cargarAvisosPublicos();

  // Configurar filtros
  document.querySelectorAll('.filtro').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.filtro').forEach(b => b.classList.remove('activo'));
      this.classList.add('activo');

      categoriaActual = this.dataset.categoria;
      paginaActual = 1;
      cargarAvisosPublicos();
    });
  });
});

async function cargarAvisosPublicos() {
  const contenedor = document.getElementById('avisos-container');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="cargando">📢 Cargando avisos...</div>';

  try {
    // 👉 Usa la URL publicada de tu hoja AVISOS en formato CSV
    const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQwiL7oD3APPpLVgrGaBh0xULVoNJt09iVBL81eG2NYTIUbCdGUOQW1dpkgjw4-k_r6KMFfz8m5VVw0/pub?gid=0&single=true&output=csv";
    const resp = await fetch(url);
    const texto = await resp.text();

    // Convertir CSV a objetos
    const filas = texto.split("\n").map(f => f.split(","));
    const encabezados = filas[0];
    let datos = filas.slice(1).map(fila => {
      let obj = {};
      encabezados.forEach((h, i) => obj[h.trim()] = fila[i] ? fila[i].trim() : "");
      return obj;
    });

    // Filtrar por categoría
    if (categoriaActual !== 'todos') {
      datos = datos.filter(aviso => aviso.categoria === categoriaActual);
    }

    if (datos.length === 0) {
      contenedor.innerHTML = '<div class="mensaje mensaje-info">📭 No hay avisos publicados</div>';
    } else {
      contenedor.innerHTML = datos.map(aviso => crearTarjetaAviso(aviso)).join('');
    }

  } catch (error) {
    console.error("Error cargando avisos públicos:", error);
    contenedor.innerHTML = `
      <div class="mensaje mensaje-error">
        ❌ Error al cargar avisos públicos. Verifica tu conexión.
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
