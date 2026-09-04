// ==============================================================
// RECUPERACIÓN DE ADMIN.JS
// Si el navegador conserva la versión truncada anterior, cargar
// explícitamente el admin.js completo con cache-busting.
// ============================================================== 
(function recuperarAdminJsSiEsNecesario(){
    const faltaAdmin = typeof window.cargarAvisosParaAdmin !== 'function' ||
                       typeof window.cargarUsuariosAdmin !== 'function' ||
                       typeof window.renderizarTablaAvisos !== 'function';

    if(!faltaAdmin) return;
    if(window.__ELBARRIO_ADMIN_RECUPERANDO__) return;

    window.__ELBARRIO_ADMIN_RECUPERANDO__ = true;
    const script = document.createElement('script');
    script.src = '/js/admin.js?v=20260904-RECOVERY-' + Date.now();
    script.onload = () => console.log('✅ ADMIN.JS RECOVERY: versión completa cargada sin caché.');
    script.onerror = () => console.error('❌ ADMIN.JS RECOVERY: no se pudo cargar admin.js.');
    document.head.appendChild(script);
})();

// ==============================================================
// ADMIN-PROMOCIONES.JS
// Control exclusivo de campos promocionales de avisos.
// La seguridad real está reforzada en Supabase mediante trigger/RLS.
// ============================================================== 
(function protegerCamposPromocionalesAdmin(){
    function esVerdadero(valor){
        return valor === true || valor === 'TRUE' || valor === 'true' || valor === 1 || valor === '1';
    }

    function sincronizarCheckboxes(id){
        try{
            const aviso = Array.isArray(window.todosLosAvisos)
                ? window.todosLosAvisos.find(a => a && String(a.id) === String(id))
                : null;

            const chkUrgente = document.getElementById('edit-urgente');
            const chkDestacado = document.getElementById('edit-destacado');

            if(!aviso) return false;

            if(chkUrgente) chkUrgente.checked = esVerdadero(aviso.urgente);
            if(chkDestacado) chkDestacado.checked = esVerdadero(aviso.destacado);

            console.log('✅ PROMOCIONES ADMIN: checkboxes sincronizados visualmente', {
                id: String(id),
                urgente: !!chkUrgente?.checked,
                destacado: !!chkDestacado?.checked,
                urgenteBD: aviso.urgente,
                destacadoBD: aviso.destacado
            });
            return true;
        }catch(error){
            console.warn('⚠️ No se pudieron sincronizar promociones:', error);
            return false;
        }
    }

    function instalar(){
        if(!window.API || typeof window.API.peticion !== 'function') return false;
        if(window.API.__promocionesAdminProtegidas__) return true;

        // 1) Sincronizar ambos checkboxes DESPUÉS de que admin.js termine
        // de llenar el formulario y abrir el modal.
        if(typeof window.editarAviso === 'function' && !window.__editarAvisoPromocionesPatched__){
            const editarOriginal = window.editarAviso;
            window.editarAviso = function(id){
                const resultado = editarOriginal.apply(this, arguments);

                // admin.js asigna los campos y abre el modal dentro de la
                // misma ejecución. Estos dos turnos garantizan que nuestra
                // sincronización ocurra al final de esa operación.
                setTimeout(() => sincronizarCheckboxes(id), 0);
                setTimeout(() => sincronizarCheckboxes(id), 100);

                return resultado;
            };
            window.__editarAvisoPromocionesPatched__ = true;
        }

        // 2) Completar el payload del guardado Supabase.
        const peticionOriginal = window.API.peticion.bind(window.API);

        window.API.peticion = async function(accion, payload, apiKey){
            try{
                if(
                    accion === 'ACTUALIZAR' &&
                    payload?.coleccion === 'AVISOS' &&
                    payload?.datos
                ){
                    const chkUrgente = document.getElementById('edit-urgente');
                    const chkDestacado = document.getElementById('edit-destacado');

                    if(chkUrgente || chkDestacado){
                        payload = {
                            ...payload,
                            datos: {
                                ...payload.datos,
                                ...(chkUrgente ? {urgente: !!chkUrgente.checked} : {}),
                                ...(chkDestacado ? {destacado: !!chkDestacado.checked} : {})
                            }
                        };
                        console.log('🔐 PROMOCIONES ADMIN: payload ACTUALIZAR', {
                            id: payload.id,
                            urgente: !!chkUrgente?.checked,
                            destacado: !!chkDestacado?.checked
                        });
                    }
                }
            }catch(error){
                console.warn('⚠️ No se pudieron preparar los campos promocionales:', error);
            }

            return peticionOriginal(accion, payload, apiKey);
        };

        window.API.__promocionesAdminProtegidas__ = true;
        console.log('✅ PROMOCIONES ADMIN: urgente y destacado integrados al guardado Supabase.');
        return true;
    }

    function intentar(){
        if(instalar()) return;
        setTimeout(intentar, 250);
    }

    if(document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', intentar, {once:true});
    }else{
        intentar();
    }
})();

// ============================================================== 
// RESPALDO DIRECTO DEL GUARDADO DE PROMOCIONES
// Este listener corre en captura, antes del handler legacy de admin.js,
// para garantizar que urgente y destacado lleguen a Supabase.
// ============================================================== 
(function respaldoGuardadoPromociones(){
    document.addEventListener('submit', async function(event){
        const form = event.target;
        if(!form || form.id !== 'form-editar') return;

        event.preventDefault();
        event.stopImmediatePropagation();

        const obtener = id => document.getElementById(id);
        const valor = id => {
            const el = obtener(id);
            return el ? String(el.value || '').trim() : '';
        };

        const id = valor('edit-id');
        if(!id){
            alert('❌ No se encontró el ID del aviso.');
            return;
        }

        const datos = {
            titulo: valor('edit-titulo'),
            contenido: valor('edit-contenido'),
            ubicacion: valor('edit-ubicacion'),
            contacto: valor('edit-contacto'),
            imagen_url: valor('edit-imagen_url'),
            video_url: valor('edit-video_url')
        };

        const fecha = valor('edit-fecha_evento');
        if(fecha) datos.fecha_evento = fecha.split('T')[0];

        const chkUrgente = obtener('edit-urgente');
        const chkDestacado = obtener('edit-destacado');
        if(chkUrgente) datos.urgente = !!chkUrgente.checked;
        if(chkDestacado) datos.destacado = !!chkDestacado.checked;

        try{
            const apiKey = localStorage.getItem('api_key');
            console.log('✏️ PROMOCIONES ADMIN: guardado directo', { id, datos });

            const resultado = await API.peticion('ACTUALIZAR', {
                coleccion: 'AVISOS',
                id,
                datos
            }, apiKey);

            if(!resultado?.success){
                throw new Error(resultado?.error || 'No se pudo actualizar el aviso.');
            }

            console.log('✅ PROMOCIONES ADMIN: urgente/destacado guardados correctamente.', resultado.data);
            alert('✅ Aviso actualizado correctamente');

            const modal = document.getElementById('modal-editar');
            if(modal) modal.style.display = 'none';
            location.reload();
        }catch(error){
            console.error('❌ PROMOCIONES ADMIN: error al guardar:', error);
            alert('❌ Error al actualizar: ' + (error?.message || error));
        }
    }, true);
})();