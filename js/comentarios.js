// ==================== COMENTARIOS.JS ====================

// Cargar comentarios de un aviso
async function cargarComentarios(avisoId) {
    const contenedor = document.getElementById('comentarios-container');
    if (!contenedor) return;

    try {
        const apiKey = localStorage.getItem('api_key');
        contenedor.innerHTML = '<p>Cargando comentarios...</p>';

        const respuesta = await API.peticion('LISTAR_COMENTARIOS', { 
            aviso_id: avisoId 
        }, apiKey);

        let comentarios = [];

        if (respuesta && respuesta.success) {
            if (respuesta.data && respuesta.data.datos && Array.isArray(respuesta.data.datos)) {
                comentarios = respuesta.data.datos;
            } else if (respuesta.datos && Array.isArray(respuesta.datos)) {
                comentarios = respuesta.datos;
            } else if (Array.isArray(respuesta.data)) {
                comentarios = respuesta.data;
            }
        }

        if (!comentarios || comentarios.length === 0) {
            contenedor.innerHTML = '<p class="sin-comentarios">💬 No hay comentarios aún. Sé el primero en comentar.</p>';
            return;
        }

        const escapeHTML = (str) => {
            if (!str) return '';
            return String(str).replace(/[&<>]/g, m => {
                if (m === '&') return '&amp;';
                if (m === '<') return '&lt;';
                if (m === '>') return '&gt;';
                return m;
            });
        };

        contenedor.innerHTML = comentarios.map(com => `
            <div class="comentario">
                <div class="comentario-header">
                    <strong>${escapeHTML(com.usuario_nombre || com.usuario_email || com.autor || 'Anónimo')}</strong>
                    <small>${new Date(com.created_at).toLocaleDateString('es-MX')}</small>
                </div>
                <div class="comentario-contenido">
                    ${escapeHTML(com.comentario || com.texto || com.contenido)}
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error:', error);
        contenedor.innerHTML = '<p class="error">❌ Error al cargar comentarios</p>';
    }
}

// Enviar comentario
window.enviarComentario = async function() {
    const input = document.getElementById('comment-input');
    const texto = input?.value.trim();
    if (!texto) return;

    const avisoId = window.currentAvisoIdForComments;
    if (!avisoId) return;

    const apiKey = localStorage.getItem('api_key');
    if (!apiKey) {
        alert('Inicia sesión para comentar');
        return;
    }

    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');

    try {
        const resultado = await API.peticion('AGREGAR_COMENTARIO', {
            avisoId: avisoId,
            texto: texto,
            autor: usuario.nombre || usuario.email
        }, apiKey);

        if (resultado?.success) {
            input.value = '';
            cargarComentarios(avisoId);
        }
    } catch (error) {
        console.error('Error:', error);
    }
};

// Abrir panel de comentarios
window.abrirComentarios = function(id, event) {
    if (event) event.stopPropagation();

    const apiKey = localStorage.getItem('api_key');
    if (!apiKey) {
        alert('Inicia sesión para ver y comentar');
        return;
    }

    window.currentAvisoIdForComments = id;
    document.getElementById('comments-panel').classList.add('open');
    cargarComentarios(id);
};

// Cerrar panel
window.cerrarPanelComentarios = function() {
    document.getElementById('comments-panel').classList.remove('open');
    window.currentAvisoIdForComments = null;
};