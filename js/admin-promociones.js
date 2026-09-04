// ==============================================================
// ADMIN-PROMOCIONES.JS
// Control exclusivo de campos promocionales de avisos.
// La seguridad real está reforzada en Supabase mediante trigger/RLS.
// Este archivo solo completa el envío de "urgente" desde el panel admin.
// ============================================================== 
(function protegerCamposPromocionalesAdmin(){
    function instalar(){
        if(!window.API || typeof window.API.peticion !== 'function') return false;
        if(window.API.__promocionesAdminProtegidas__) return true;

        const peticionOriginal = window.API.peticion.bind(window.API);

        window.API.peticion = async function(accion, payload, apiKey){
            try{
                if(
                    accion === 'ACTUALIZAR' &&
                    payload?.coleccion === 'AVISOS' &&
                    payload?.datos &&
                    document.getElementById('edit-urgente')
                ){
                    payload = {
                        ...payload,
                        datos: {
                            ...payload.datos,
                            urgente: !!document.getElementById('edit-urgente').checked
                        }
                    };
                }
            }catch(error){
                console.warn('⚠️ No se pudo preparar el campo urgente:', error);
            }

            return peticionOriginal(accion, payload, apiKey);
        };

        window.API.__promocionesAdminProtegidas__ = true;
        console.log('✅ PROMOCIONES ADMIN: urgente integrado al guardado Supabase.');
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
