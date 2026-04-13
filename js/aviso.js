// ==================== DETALLE DE AVISO ====================

document.addEventListener('DOMContentLoaded', function () {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');
  const editar = urlParams.get('editar') === 'true';

  if (!id) {
    window.location.href = 'index.html';
    return;
  }

  cargarAviso(id, editar);
});

async function cargarAviso(id, modoEditar = false) {
  const contenedor = document.getElementById('aviso-detalle');
  if (!contenedor) return;

  try {
    const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQwiL7oD3APPpLVgrGaBh0xULVoNJt09iVBL81eG2NYTIUbCdGUOQW1dpkgjw4-k_r6KMFfz8m5VVw0/pub?gid=0&single=true&output=csv"; // reemplaza TU_ID por el de tu hoja
    const resp = await fetch(url);
    const texto = await resp.text();

    const filas = texto.split("\n").map(f => f.split(","));
    const encabezados = filas[0];
    const datos = filas.slice(1).map(fila => {
      let obj = {};
      encabezados.forEach((h, i) => obj[h.trim()] = fila[i] ? fila[i].trim() : "");
      return obj;
    });

    // ✅ Buscar por id, asegurando que se comparen como strings sin espacios
    const aviso = datos.find(a => a.id && a.id.trim() === id.trim());

    if (!aviso) {
      contenedor.innerHTML = '<div class="mensaje mensaje-error">Aviso no encontrado</div>';
      return;
    }

    if (modoEditar && API.getUsuarioActual()) {
      contenedor.innerHTML = crearFormularioEdicion(aviso);
      // Aquí puedes añadir la lógica de guardar cambios vía API.actualizar
    } else {
      contenedor.innerHTML = crearVistaDetalle(aviso);
    }
  } catch (error) {
    console.error("Error cargando aviso:", error);
    contenedor.innerHTML = '<div class="mensaje mensaje-error">Error cargando aviso</div>';
  }
}

function crearVistaDetalle(aviso) {
  let fecha = aviso.created_at
    ? new Date(aviso.created_at).toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    : 'Fecha no disponible';

  const claseUrgente = aviso.categoria === 'urgente' ? 'urgente' : '';

  const nombresCategoria = {
    'urgente': '⚠️ Urgente',
    'eventos': '🎉 Eventos',
    'servicios': '🛠️ Servicios',
    'perdidos': '🐾 Perdidos',
    'clasificados': '📢 Clasificados'
  };

  const categoriaNombre = nombresCategoria[aviso.categoria] || 'General';
  const clicks = aviso.clicks || 0;

  let html = `
    <div class="tarjeta ${claseUrgente}">
      <h1 class="tarjeta-titulo" style="font-size: 24px;">
        ${aviso.titulo || 'Sin título'}
      </h1>

      <div class="tarjeta-fecha">
        Publicado: ${fecha}
      </div>

      <div class="tarjeta-meta">
        <span>${categoriaNombre}</span>
        ${aviso.ubicacion ? `<span>📍 ${aviso.ubicacion}</span>` : ''}
        <span>👁️ ${clicks} interesados</span>
      </div>

      <div class="tarjeta-contenido" style="font-size: 18px; line-height: 1.6;">
        ${aviso.contenido || ''}
      </div>
  `;

  // 📲 WhatsApp seguro (sin romper nada)
  if (aviso.contacto) {
    let num = String(aviso.contacto).replace(/\D/g, '');
    let telefono = null;

    if (num.length === 10) telefono = '521' + num;
    else if (num.startsWith('52') && num.length === 12) telefono = num;
    else if (num.startsWith('521') && num.length === 13) telefono = num;

    if (telefono) {
      const mensaje = encodeURIComponent(
        `Hola, vi tu anuncio (${aviso.id}) de ${aviso.titulo} en Jardines Vallarta. ¿Sigue disponible?`
      );

      const link = `https://wa.me/${telefono}?text=${mensaje}`;

      html += `
        <div style="margin-top:16px;">
          <a href="${link}" target="_blank" class="boton"
             style="background:#25D366; color:white;">
            📲 Contactar por WhatsApp
          </a>
        </div>
      `;
    } else {
      html += `<div class="tarjeta-meta"><span>📞 ${aviso.contacto}</span></div>`;
    }
  }

  if (aviso.fecha_evento) {
    const fechaEvento = new Date(aviso.fecha_evento).toLocaleDateString('es-MX');
    html += `<div class="tarjeta-meta"><span>📅 Fecha del evento: ${fechaEvento}</span></div>`;
  }

  if (aviso.imagen_url) {
    html += `
      <div style="margin-top:16px;">
        <img src="${aviso.imagen_url}" 
             style="max-width:100%; border-radius:6px;">
      </div>
    `;
  }

  html += `
      <div style="margin-top: 24px;">
        <a href="index.html" class="boton boton-chico">
          ← Volver
        </a>
      </div>
    </div>
  `;

  return html;
}

function crearFormularioEdicion(aviso) {
  return `
    <form id="form-editar" class="formulario" style="max-width: 100%;">
      <h2 style="margin-bottom: 24px; font-weight: 500;">Editar aviso</h2>
      
      <div class="campo">
        <label for="edit-titulo">Título</label>
        <input type="text" id="edit-titulo" value="${aviso.titulo || ''}" required>
      </div>
      
      <div class="campo">
        <label for="edit-contenido">Descripción</label>
        <textarea id="edit-contenido" required>${aviso.contenido || ''}</textarea>
      </div>
      
      <div class="campo">
        <label for="edit-ubicacion">Ubicación</label>
        <input type="text" id="edit-ubicacion" value="${aviso.ubicacion || ''}">
      </div>
      
      <div class="campo">
        <label for="edit-contacto">Contacto</label>
        <input type="text" id="edit-contacto" value="${aviso.contacto || ''}">
      </div>
      
      <div class="campo">
        <label for="edit-fecha">Fecha del evento</label>
        <input type="date" id="edit-fecha" value="${aviso.fecha_evento || ''}">
      </div>
      
      <div class="grupo-botones">
        <button type="submit" class="boton">Guardar cambios</button>
        <button type="button" class="boton boton-secundario" id="cancelar-editar">Cancelar</button>
      </div>
    </form>
  `;
}
