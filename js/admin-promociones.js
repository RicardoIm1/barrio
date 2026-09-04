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

    function instalar(){
        if(!window.API || typeof window.API.peticion !== 'function') return false;
        if(window.API.__promocionesAdminProtegidas__) return true;

        // 1) Corregir la carga de ambos checkboxes al abrir un aviso.
        if(typeof window.editarAviso === 'function' && !window.__editarAvisoPromocionesPatched__){
            const editarOriginal = window.editarAviso;
            window.editarAviso = function(id){
                const resultado = editarOriginal.apply(this, arguments);
                try{
                    const aviso = Array.isArray(window.todosLosAvisos)
                        ? window.todosLosAvisos.find(a => a && String(a.id) === String(id))
                        : null;

                    const chkUrgente = document.getElementById('edit-urgente');
                    const chkDestacado = document.getElementById('edit-destacado');

                    if(aviso){
                        if(chkUrgente) chkUrgente.checked = esVerdadero(aviso.urgente);
                        if(chkDestacado) chkDestacado.checked = esVerdadero(aviso.destacado);
                        console.log('✅ PROMOCIONES ADMIN: checkboxes sincronizados', {
                            urgente: !!chkUrgente?.checked,
                            destacado: !!chkDestacado?.checked
                        });
                    }
                }catch(error){
                    console.warn('⚠️ No se pudieron sincronizar promociones:', error);
                }
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