// ==================== DETALLE DE AVISO CON API Y MULTIMEDIA ====================

let multimediaManager = null;

document.addEventListener('DOMContentLoaded', function () {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');
  const editar = urlParams.get('editar') === 'true';

  if (!id) {
    window.location.href = 'index.html';
    return;
  }

  // Inicializar multimedia manager si existe la clase
  if (typeof MultimediaManager !== 'undefined') {
    multimediaManager = new MultimediaManager(API);
  }

  cargarAviso(id, editar);
});

async function cargarAviso(id, modoEditar = false) {
  const contenedor = document.getElementById('aviso-detalle');
  if (!contenedor) return;

  try {
    const resultado = await API.listar('AVISOS');
    
    if (!resultado || !resultado.datos) {
      throw new Error('No se pudieron cargar los avisos');
    }
    
    const aviso = resultado.datos.find(a => a.id && a.id.toString().trim() === id.toString().trim());

    if (!aviso) {
      contenedor.innerHTML = '<div class="mensaje mensaje-error">❌ Aviso no encontrado</div>';
      return;
    }

    registrarClick(id);

    const usuarioActual = API.getUsuarioActual();
    const puedeEditar = usuarioActual && (usuarioActual.rol === 'admin' || aviso.created_by === usuarioActual.id);

    if (modoEditar && puedeEditar) {
      contenedor.innerHTML = crearFormularioEdicion(aviso);
      inicializarFormularioEdicion(aviso.id);
    } else {
      contenedor.innerHTML = await crearVistaDetalle(aviso, puedeEditar);
      if (multimediaManager && aviso.id) {
        cargarMultimedia(aviso.id);
        inicializarSubidaMultimedia(aviso.id);
      }
    }
  } catch (error) {
    console.error("Error cargando aviso:", error);
    contenedor.innerHTML = `<div class="mensaje mensaje-error">❌ Error cargando aviso: ${error.message}</div>`;
  }
}

async function registrarClick(id) {
  try {
    console.log(`Vista registrada para aviso ${id}`);
  } catch (error) {
    console.error('Error registrando click:', error);
  }
}

async function crearVistaDetalle(aviso, puedeEditar = false) {
  let fecha = aviso.created_at
    ? new Date(aviso.created_at).toLocaleDateString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'Fecha no disponible';

  const nombresCategoria = {
    'urgente': '⚠️ Urgente',
    'eventos': '🎉 Eventos',
    'servicios': '🛠️ Servicios',
    'perdidos': '🐾 Perdidos',
    'clasificados': '📢 Clasificados'
  };

  const categoriaNombre = nombresCategoria[aviso.categoria] || '📰 General';

  let html = `
    <div class="aviso-detalle-contenido">
      <span class="aviso-categoria">${categoriaNombre}</span>
      
      <h1 class="aviso-titulo">${escapeHtml(aviso.titulo || 'Sin título')}</h1>
      
      <div class="aviso-meta">
        <span>📅 ${fecha}</span>
        ${aviso.ubicacion ? `<span>📍 ${escapeHtml(aviso.ubicacion)}</span>` : ''}
        <span>👁️ ${aviso.clicks || 0} vistas</span>
      </div>
      
      <div class="aviso-contenido">
        ${formatContenido(aviso.contenido || '')}
      </div>
  `;

  html += `<div class="aviso-info-adicional">`;
  
  if (aviso.contacto) {
    const whatsappLink = generarWhatsAppLink(aviso.contacto, aviso.id, aviso.titulo);
    if (whatsappLink) {
      html += `
        <p>
          <a href="${whatsappLink}" target="_blank" class="boton" style="background:#25D366; color:white; display:inline-block; padding:10px 20px; border-radius:8px; text-decoration:none;">
            📲 Contactar por WhatsApp
          </a>
        </p>
      `;
    } else {
      html += `<p>📞 Contacto: ${escapeHtml(aviso.contacto)}</p>`;
    }
  }
  
  if (aviso.fecha_evento && aviso.fecha_evento !== '') {
    let fechaEventoStr = aviso.fecha_evento;
    if (fechaEventoStr.includes('T')) {
      fechaEventoStr = fechaEventoStr.split('T')[0];
    }
    const fechaEvento = new Date(fechaEventoStr).toLocaleDateString('es-MX');
    html += `<p>📅 Fecha del evento: ${fechaEvento}</p>`;
  }
  
  if (aviso.ubicacion) {
    html += `<p>📍 Ubicación: ${escapeHtml(aviso.ubicacion)}</p>`;
  }
  
  html += `</div>`;

  if (aviso.imagen_url && aviso.imagen_url !== '') {
    html += `
      <div style="margin: 20px 0;">
        <img src="${aviso.imagen_url}" alt="${escapeHtml(aviso.titulo)}" style="max-width:100%; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
      </div>
    `;
  }

  html += `<div id="multimedia-gallery" class="gallery"><div class="cargando">🖼️ Cargando multimedia...</div></div>`;

  const usuarioActual = API.getUsuarioActual();
  if (usuarioActual) {
    html += `
      <div id="upload-area-container" style="margin: 20px 0;">
        <div class="upload-area" id="dropZone">
          📁 Arrastra imágenes o videos aquí o haz clic para seleccionar
          <input type="file" id="fileInput" multiple accept="image/*,video/*" style="display:none">
        </div>
      </div>
    `;
  }

  html += `<div style="margin-top: 30px; display: flex; gap: 10px; flex-wrap: wrap;">`;
  html += `<a href="index.html" class="boton-volver">← Volver al inicio</a>`;
  
  if (puedeEditar) {
    html += `<a href="?id=${aviso.id}&editar=true" class="boton" style="background:#007bff; color:white; text-decoration:none; padding:10px 20px; border-radius:8px;">✏️ Editar aviso</a>`;
  }
  
  if (usuarioActual && (usuarioActual.rol === 'admin' || aviso.created_by === usuarioActual.id)) {
    html += `<button onclick="eliminarAviso('${aviso.id}')" class="boton" style="background:#dc3545; color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer;">🗑️ Eliminar aviso</button>`;
  }
  
  html += `</div></div>`;

  return html;
}

function generarWhatsAppLink(contacto, avisoId, titulo) {
  let num = String(contacto).replace(/\D/g, '');
  let telefono = null;

  if (num.length === 10) telefono = '521' + num;
  else if (num.startsWith('52') && num.length === 12) telefono = num;
  else if (num.startsWith('521') && num.length === 13) telefono = num;
  else if (num.length === 13) telefono = num;

  if (telefono) {
    const mensaje = encodeURIComponent(
      `Hola, vi tu anuncio "${titulo}" (ID: ${avisoId}) en Avisos Jardines Vallarta. ¿Sigue disponible?`
    );
    return `https://wa.me/${telefono}?text=${mensaje}`;
  }
  return null;
}

function formatContenido(texto) {
  if (!texto) return '';
  const parrafos = texto.split('\n').filter(p => p.trim());
  return parrafos.map(p => `<p>${escapeHtml(p)}</p>`).join('');
}

function escapeHtml(texto) {
  if (!texto) return '';
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

function crearFormularioEdicion(aviso) {
  return `
    <div style="padding: 20px;">
      <h2 style="margin-bottom: 24px; font-weight: 500;">✏️ Editar aviso</h2>
      
      <form id="form-editar" class="formulario">
        <div class="campo">
          <label for="edit-titulo">Título *</label>
          <input type="text" id="edit-titulo" value="${escapeHtml(aviso.titulo || '')}" required>
        </div>
        
        <div class="campo">
          <label for="edit-categoria">Categoría</label>
          <select id="edit-categoria">
            <option value="general" ${aviso.categoria === 'general' ? 'selected' : ''}>📰 General</option>
            <option value="urgente" ${aviso.categoria === 'urgente' ? 'selected' : ''}>⚠️ Urgente</option>
            <option value="eventos" ${aviso.categoria === 'eventos' ? 'selected' : ''}>🎉 Eventos</option>
            <option value="servicios" ${aviso.categoria === 'servicios' ? 'selected' : ''}>🛠️ Servicios</option>
            <option value="perdidos" ${aviso.categoria === 'perdidos' ? 'selected' : ''}>🐾 Perdidos</option>
            <option value="clasificados" ${aviso.categoria === 'clasificados' ? 'selected' : ''}>📢 Clasificados</option>
          </select>
        </div>
        
        <div class="campo">
          <label for="edit-contenido">Descripción *</label>
          <textarea id="edit-contenido" rows="6" required>${escapeHtml(aviso.contenido || '')}</textarea>
        </div>
        
        <div class="campo">
          <label for="edit-ubicacion">Ubicación</label>
          <input type="text" id="edit-ubicacion" value="${escapeHtml(aviso.ubicacion || '')}">
        </div>
        
        <div class="campo">
          <label for="edit-contacto">Contacto</label>
          <input type="text" id="edit-contacto" value="${escapeHtml(aviso.contacto || '')}">
        </div>
        
        <div class="campo">
          <label for="edit-fecha">📅 Fecha del evento</label>
          <input type="date" id="edit-fecha" value="${aviso.fecha_evento ? aviso.fecha_evento.split('T')[0] : ''}">
        </div>
        
        <div class="campo">
          <label for="edit-imagen">URL de imagen destacada</label>
          <input type="url" id="edit-imagen" value="${aviso.imagen_url || ''}" placeholder="https://...">
        </div>
        
        <div class="grupo-botones" style="display: flex; gap: 10px; margin-top: 20px;">
          <button type="submit" class="boton">💾 Guardar cambios</button>
          <button type="button" class="boton boton-secundario" id="cancelar-editar" style="background:#6c757d;">❌ Cancelar</button>
        </div>
      </form>
    </div>
  `;
}

function inicializarFormularioEdicion(avisoId) {
  const form = document.getElementById('form-editar');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const datosActualizados = {
      titulo: document.getElementById('edit-titulo').value,
      categoria: document.getElementById('edit-categoria').value,
      contenido: document.getElementById('edit-contenido').value,
      ubicacion: document.getElementById('edit-ubicacion').value,
      contacto: document.getElementById('edit-contacto').value,
      fecha_evento: document.getElementById('edit-fecha').value,
      imagen_url: document.getElementById('edit-imagen').value,
      updated_at: new Date().toISOString()
    };
    
    try {
      const resultado = await API.actualizar('AVISOS', avisoId, datosActualizados);
      
      if (resultado && resultado.success) {
        API.mostrarExito('✅ Aviso actualizado correctamente');
        setTimeout(() => {
          window.location.href = `aviso.html?id=${avisoId}`;
        }, 1500);
      } else {
        API.mostrarError('❌ Error al actualizar: ' + (resultado?.error || 'Desconocido'));
      }
    } catch (error) {
      console.error('Error actualizando:', error);
      API.mostrarError('❌ Error al actualizar el aviso');
    }
  });
  
  const cancelarBtn = document.getElementById('cancelar-editar');
  if (cancelarBtn) {
    cancelarBtn.addEventListener('click', () => {
      window.location.href = `aviso.html?id=${avisoId}`;
    });
  }
}

async function cargarMultimedia(avisoId) {
  if (!multimediaManager) return;
  
  try {
    const resultado = await multimediaManager.listarMultimedia(avisoId);
    const gallery = document.getElementById('multimedia-gallery');
    
    if (!gallery) return;
    
    if (resultado.success && resultado.data.archivos && resultado.data.archivos.length > 0) {
      mostrarGaleria(resultado.data.archivos, avisoId);
    } else {
      gallery.innerHTML = '<p style="color:#999; text-align:center;">📷 No hay imágenes o videos asociados</p>';
    }
  } catch (error) {
    console.error('Error cargando multimedia:', error);
    const gallery = document.getElementById('multimedia-gallery');
    if (gallery) {
      gallery.innerHTML = '<p style="color:#999; text-align:center;">❌ Error cargando multimedia</p>';
    }
  }
}

function mostrarGaleria(archivos, avisoId) {
  const gallery = document.getElementById('multimedia-gallery');
  if (!gallery) return;
  
  if (!archivos || archivos.length === 0) {
    gallery.innerHTML = '<p style="color:#999; text-align:center;">📷 No hay imágenes o videos asociados</p>';
    return;
  }
  
  const usuarioActual = API.getUsuarioActual();
  const puedeEliminar = usuarioActual !== null;
  
  gallery.innerHTML = archivos.map(archivo => {
    let preview = '';
    if (archivo.mimeType.startsWith('image/')) {
      preview = `<img src="${archivo.url}" alt="${archivo.name}" loading="lazy">`;
    } else if (archivo.mimeType.startsWith('video/')) {
      preview = `<video controls><source src="${archivo.url}" type="${archivo.mimeType}"></video>`;
    } else {
      preview = `<div>📎 ${archivo.name}</div>`;
    }
    
    const botonEliminar = puedeEliminar ? 
      `<button class="btn-eliminar-media" onclick="eliminarArchivoMultimedia('${archivo.id}', '${avisoId}')">🗑️ Eliminar</button>` : '';
    
    return `
      <div class="media-item">
        ${preview}
        <p style="font-size: 12px; margin-top: 8px;">${archivo.name.substring(0, 30)}</p>
        ${botonEliminar}
      </div>
    `;
  }).join('');
}

async function eliminarArchivoMultimedia(fileId, avisoId) {
  if (!confirm('¿Eliminar este archivo permanentemente?')) return;
  
  try {
    const resultado = await multimediaManager.eliminarArchivo(fileId);
    if (resultado.success) {
      API.mostrarExito('✅ Archivo eliminado');
      await cargarMultimedia(avisoId);
    } else {
      API.mostrarError('❌ Error al eliminar archivo');
    }
  } catch (error) {
    console.error('Error eliminando:', error);
    API.mostrarError('❌ Error al eliminar archivo');
  }
}

function inicializarSubidaMultimedia(avisoId) {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  
  if (!dropZone || !fileInput) return;
  
  dropZone.addEventListener('click', () => fileInput.click());
  
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });
  
  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files);
    await subirArchivosMultimedia(avisoId, files);
  });
  
  fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    await subirArchivosMultimedia(avisoId, files);
    fileInput.value = '';
  });
}

async function subirArchivosMultimedia(avisoId, files) {
  if (!multimediaManager) {
    API.mostrarError('❌ Gestor multimedia no disponible');
    return;
  }
  
  API.mostrarExito(`📤 Subiendo ${files.length} archivo(s)...`);
  
  const resultados = await multimediaManager.subirMultiplesArchivos(avisoId, files);
  
  resultados.forEach(r => {
    if (r.success) {
      API.mostrarExito(`✅ ${r.file} subido correctamente`);
    } else {
      API.mostrarError(`❌ ${r.file}: ${r.error}`);
    }
  });
  
  await cargarMultimedia(avisoId);
}

// Funciones globales
window.eliminarAviso = async function(id) {
  if (!confirm('⚠️ ¿Estás seguro de que quieres eliminar este aviso? Esta acción no se puede deshacer.')) return;
  
  try {
    const resultado = await API.eliminar('AVISOS', id);
    
    if (resultado && resultado.success) {
      API.mostrarExito('✅ Aviso eliminado correctamente');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1500);
    } else {
      API.mostrarError('❌ Error al eliminar: ' + (resultado?.error || 'Desconocido'));
    }
  } catch (error) {
    console.error('Error eliminando aviso:', error);
    API.mostrarError('❌ Error al eliminar el aviso');
  }
};

window.eliminarArchivoMultimedia = eliminarArchivoMultimedia;