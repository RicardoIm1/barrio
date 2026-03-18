// ==================== DETALLE DE AVISO ====================

document.addEventListener('DOMContentLoaded', function() {
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
    const aviso = await API.leer('AVISOS', id);
    
    if (modoEditar && API.getUsuarioActual()) {
      contenedor.innerHTML = crearFormularioEdicion(aviso);
      
      document.getElementById('form-editar').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const datos = {
          titulo: document.getElementById('edit-titulo').value,
          contenido: document.getElementById('edit-contenido').value,
          ubicacion: document.getElementById('edit-ubicacion').value,
          contacto: document.getElementById('edit-contacto').value,
          fecha_evento: document.getElementById('edit-fecha').value
        };
        
        try {
          await API.actualizar('AVISOS', id, datos);
          API.mostrarExito('Aviso actualizado');
          window.location.href = `aviso.html?id=${id}`;
        } catch(error) {}
      });
      
      document.getElementById('cancelar-editar').addEventListener('click', function() {
        window.location.href = `aviso.html?id=${id}`;
      });
      
    } else {
      contenedor.innerHTML = crearVistaDetalle(aviso);
    }
    
  } catch(error) {
    contenedor.innerHTML = '<div class="mensaje mensaje-error">Aviso no encontrado</div>';
  }
}

function crearVistaDetalle(aviso) {
  const fecha = new Date(aviso.created_at).toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const claseUrgente = aviso.categoria === 'urgente' ? 'urgente' : '';
  
  let html = `
    <div class="tarjeta ${claseUrgente}">
      <h1 class="tarjeta-titulo" style="font-size: 24px;">${aviso.titulo}</h1>
      <div class="tarjeta-fecha">Publicado: ${fecha}</div>
      <div class="tarjeta-contenido" style="font-size: 18px; line-height: 1.6;">${aviso.contenido}</div>
  `;
  
  if (aviso.ubicacion) {
    html += `<div class="tarjeta-meta"><span>📍 Ubicación: ${aviso.ubicacion}</span></div>`;
  }
  
  if (aviso.contacto) {
    html += `<div class="tarjeta-meta"><span>📞 Contacto: ${aviso.contacto}</span></div>`;
  }
  
  if (aviso.fecha_evento) {
    const fechaEvento = new Date(aviso.fecha_evento).toLocaleDateString();
    html += `<div class="tarjeta-meta"><span>📅 Fecha del evento: ${fechaEvento}</span></div>`;
  }
  
  html += `
      <div style="margin-top: 24px;">
        <a href="index.html" class="boton boton-chico" style="width: auto;">Volver</a>
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
        <input type="text" id="edit-titulo" value="${aviso.titulo}" required>
      </div>
      
      <div class="campo">
        <label for="edit-contenido">Descripción</label>
        <textarea id="edit-contenido" required>${aviso.contenido}</textarea>
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