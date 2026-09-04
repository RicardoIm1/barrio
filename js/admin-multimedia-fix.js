// ============================================================
// MULTIMEDIA PARA EDICIÓN DE AVISOS
// Supabase Storage: bucket "media"
// ============================================================
(function () {
    'use strict';

    if (window.__ELBARRIO_ADMIN_MULTIMEDIA__) return;
    window.__ELBARRIO_ADMIN_MULTIMEDIA__ = true;

    const BUCKET = 'media';
    let modo = null;
    let ocupado = false;

    const $ = id => document.getElementById(id);

    function cliente() {
        return window.supabaseClient || window.__elBarrioSupabaseClient || null;
    }

    function usuarioId() {
        try {
            const u = JSON.parse(localStorage.getItem('usuario') || 'null');
            return u?.id || null;
        } catch (_) {
            return null;
        }
    }

    function nombreSeguro(nombre) {
        return String(nombre || 'archivo')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9._-]+/g, '_')
            .replace(/^\.+/, '')
            .slice(0, 100) || 'archivo';
    }

    function mostrarVistaPrevia(url, tipo) {
        const cont = $('edit-vista-previa');
        if (!cont || !url) return;
        cont.innerHTML = tipo === 'imagen'
            ? `<img src="${url}" alt="Vista previa" style="max-width:100%;max-height:220px;border-radius:10px;object-fit:contain;">`
            : `<video src="${url}" controls playsinline style="max-width:100%;max-height:220px;border-radius:10px;"></video>`;
    }

    async function subirArchivo(file, tipo) {
        if (ocupado) return;

        const client = cliente();
        if (!client) {
            alert('❌ No está disponible la conexión con Supabase.');
            return;
        }

        const uid = usuarioId();
        const avisoId = String($('edit-id')?.value || '').trim();
        if (!uid || !avisoId) {
            alert('❌ No se encontró la sesión o el ID del aviso.');
            return;
        }

        const esImagen = tipo === 'imagen';
        if (esImagen && !file.type.startsWith('image/')) {
            alert('❌ Selecciona un archivo de imagen.');
            return;
        }
        if (!esImagen && !file.type.startsWith('video/')) {
            alert('❌ Selecciona un archivo de video.');
            return;
        }

        const limite = 10 * 1024 * 1024;
        if (file.size > limite) {
            alert('❌ El archivo supera el límite de 10 MB del bucket media.');
            return;
        }

        ocupado = true;
        const btn = esImagen ? $('edit-btn-imagen') : $('edit-btn-video');
        const textoOriginal = btn?.textContent;
        if (btn) {
            btn.disabled = true;
            btn.textContent = '⏳ Subiendo...';
        }

        try {
            const extension = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
            const ruta = `avisos/${uid}/${avisoId}/${Date.now()}-${nombreSeguro(file.name.replace(/\.[^.]+$/, ''))}.${extension}`;

            const { error } = await client.storage
                .from(BUCKET)
                .upload(ruta, file, {
                    cacheControl: '3600',
                    contentType: file.type,
                    upsert: false
                });

            if (error) throw error;

            const { data } = client.storage.from(BUCKET).getPublicUrl(ruta);
            const url = data?.publicUrl;
            if (!url) throw new Error('Supabase no devolvió la URL pública del archivo.');

            if (esImagen) {
                $('edit-imagen_url').value = url;
            } else {
                $('edit-video_url').value = url;
            }

            mostrarVistaPrevia(url, tipo);
            console.log(`✅ Multimedia de edición subida (${tipo}):`, url);
            alert(`✅ ${esImagen ? 'Imagen' : 'Video'} cargado correctamente. Ahora pulsa «Guardar cambios».`);
        } catch (error) {
            console.error('❌ Error subiendo multimedia de edición:', error);
            alert('❌ No se pudo subir el archivo: ' + (error?.message || error));
        } finally {
            ocupado = false;
            if (btn) {
                btn.disabled = false;
                btn.textContent = textoOriginal || (esImagen ? '📸 Imagen' : '🎥 Video');
            }
            const input = $('edit-archivo-multimedia');
            if (input) input.value = '';
        }
    }

    function instalar() {
        const btnImagen = $('edit-btn-imagen');
        const btnVideo = $('edit-btn-video');
        const input = $('edit-archivo-multimedia');
        if (!btnImagen || !btnVideo || !input) return false;
        if (btnImagen.dataset.elBarrioMediaReady === '1') return true;

        btnImagen.dataset.elBarrioMediaReady = '1';
        btnVideo.dataset.elBarrioMediaReady = '1';

        btnImagen.addEventListener('click', event => {
            event.preventDefault();
            modo = 'imagen';
            input.accept = 'image/*';
            input.click();
        });

        btnVideo.addEventListener('click', event => {
            event.preventDefault();
            modo = 'video';
            input.accept = 'video/*';
            input.click();
        });

        input.addEventListener('change', () => {
            const file = input.files?.[0];
            if (file && modo) subirArchivo(file, modo);
        });

        console.log('✅ Multimedia de edición conectada al bucket Supabase "media".');
        return true;
    }

    function observar() {
        if (instalar()) return;
        const observer = new MutationObserver(() => {
            if (instalar()) observer.disconnect();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        setTimeout(() => observer.disconnect(), 30000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', observar, { once: true });
    } else {
        observar();
    }
})();
