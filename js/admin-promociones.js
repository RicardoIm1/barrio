// ==============================================================
// ADMIN-PROMOCIONES.JS
// Interfaz de Urgente / Destacado para administradores.
// La seguridad real permanece en Supabase mediante trigger/RLS.
// ============================================================== 
(function inicializarPromocionesAdmin(){
    const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

    function esVerdadero(v){
        return v === true || v === 'true' || v === 'TRUE' || v === 1 || v === '1';
    }

    function usuarioActual(){
        try{
            if(window.API && typeof window.API.getUsuarioActual === 'function'){
                const u = window.API.getUsuarioActual();
                if(u) return u;
            }
        }catch(e){}
        try{return JSON.parse(localStorage.getItem('usuario') || 'null');}catch(e){return null;}
    }

    function esAdmin(){
        const u = usuarioActual();
        return String(u?.rol || '').toLowerCase() === 'admin';
    }

    function buscarCheckbox(form, tipo){
        if(!form) return null;
        const ids = tipo === 'urgente'
            ? ['edit-urgente','crear-urgente','urgente','nuevo-urgente']
            : ['edit-destacado','crear-destacado','destacado','nuevo-destacado'];

        for(const id of ids){
            const el = document.getElementById(id);
            if(el && el.type === 'checkbox' && form.contains(el)) return el;
        }

        const palabra = tipo === 'urgente' ? 'urgente' : 'destacado';
        return [...form.querySelectorAll('input[type="checkbox"]')].find(input => {
            const label = input.closest('label');
            return String(label?.textContent || '').toLowerCase().includes(palabra);
        }) || null;
    }

    function ocultarControl(input, ocultar){
        if(!input) return;
        const contenedor = input.closest('label') || input.parentElement;
        if(contenedor) contenedor.style.display = ocultar ? 'none' : '';
        input.disabled = !!ocultar;
    }

    function actualizarVisibilidadFormularios(){
        const admin = esAdmin();
        ocultarControl(buscarCheckbox(document.getElementById('form-aviso'),'urgente'), !admin);
        ocultarControl(buscarCheckbox(document.getElementById('form-aviso'),'destacado'), !admin);
        ocultarControl(buscarCheckbox(document.getElementById('form-editar'),'urgente'), !admin);
        ocultarControl(buscarCheckbox(document.getElementById('form-editar'),'destacado'), !admin);
    }

    async function obtenerAviso(id){
        let aviso = Array.isArray(window.todosLosAvisos)
            ? window.todosLosAvisos.find(a => a && String(a.id) === String(id))
            : null;
        try{
            let client = window.__elBarrioSupabaseClient || null;
            if(!client && typeof window.obtenerSupabaseClient === 'function') client = await window.obtenerSupabaseClient();
            if(client){
                const {data,error} = await client.from('avisos').select('id,urgente,destacado').eq('id',id).maybeSingle();
                if(!error && data) aviso = {...(aviso || {}), ...data};
                if(error) console.warn('⚠️ Promociones: no se pudo leer el aviso:', error);
            }
        }catch(error){console.warn('⚠️ Promociones: error leyendo Supabase:',error);}
        return aviso;
    }

    async function sincronizarEdicion(id){
        if(!esAdmin()) return;
        const aviso = await obtenerAviso(id);
        if(!aviso) return;
        const urgente = document.getElementById('edit-urgente');
        const destacado = document.getElementById('edit-destacado');
        if(urgente) urgente.checked = esVerdadero(aviso.urgente);
        if(destacado) destacado.checked = esVerdadero(aviso.destacado);
        console.log('📌 PROMOCIONES ADMIN: estado real desde Supabase',{id:String(id),urgente:esVerdadero(aviso.urgente),destacado:esVerdadero(aviso.destacado)});
    }

    function extraerIdFila(fila){
        const directo = fila.dataset?.id || fila.getAttribute('data-id');
        if(directo && UUID_RE.test(directo)) return directo.match(UUID_RE)[0];
        for(const el of fila.querySelectorAll('[onclick],[data-id],[href]')){
            const texto=[el.getAttribute('onclick'),el.getAttribute('data-id'),el.getAttribute('href')].filter(Boolean).join(' ');
            const match=texto.match(UUID_RE);
            if(match) return match[0];
        }
        const match=String(fila.innerHTML||'').match(UUID_RE);
        return match ? match[0] : null;
    }

    function botonPromocion(texto){
        const b=document.createElement('button');
        b.type='button';
        b.className='boton boton-chico boton-secundario';
        b.style.margin='2px';
        b.style.color='white';
        b.textContent=texto;
        return b;
    }

    async function alternarUrgente(id,boton){
        if(!esAdmin()) return alert('⛔ Esta acción requiere permisos de administrador.');
        const aviso=await obtenerAviso(id);
        if(!aviso) return alert('❌ No se encontró el aviso.');
        const nuevo=!esVerdadero(aviso.urgente);
        try{
            const resultado=await API.peticion('ACTUALIZAR',{coleccion:'AVISOS',id,datos:{urgente:nuevo}},localStorage.getItem('api_key'));
            if(!resultado?.success) throw new Error(resultado?.error||'No se pudo actualizar urgente.');
            if(Array.isArray(window.todosLosAvisos)){
                const local=window.todosLosAvisos.find(a=>String(a?.id)===String(id));
                if(local) local.urgente=nuevo;
            }
            if(boton){boton.textContent=nuevo?'⚠️ Quitar urgente':'⚠️ Urgente';boton.title=nuevo?'Quitar urgente':'Marcar como urgente';}
            console.log('✅ URGENTE actualizado:',{id,urgente:nuevo});
        }catch(error){
            console.error('❌ Error actualizando urgente:',error);
            alert('❌ No se pudo cambiar Urgente: '+(error?.message||error));
        }
    }

    async function prepararTabla(){
        if(!esAdmin()){
            document.querySelectorAll('.tabla-admin button').forEach(b=>{
                if(/destacar|urgente/i.test(b.textContent||'')) b.style.display='none';
            });
            return;
        }

        document.querySelectorAll('.tabla-admin tbody tr').forEach(async fila=>{
            if(fila.dataset.promocionesReady) return;
            const id=extraerIdFila(fila);
            if(!id) return;
            const celdas=fila.querySelectorAll('td');
            const acciones=celdas[celdas.length-1];
            if(!acciones) return;
            fila.dataset.promocionesReady='pending';

            const aviso=await obtenerAviso(id);
            if(!aviso){fila.dataset.promocionesReady='';return;}

            acciones.querySelectorAll('button').forEach(b=>{
                if(/destacar/i.test(b.textContent||'')){
                    b.textContent=esVerdadero(aviso.destacado)?'⭐ Quitar destacado':'⭐ Destacar';
                    b.title=esVerdadero(aviso.destacado)?'Quitar destacado':'Marcar como destacado';
                }
            });

            if(!acciones.querySelector('[data-promocion-urgente="1"]')){
                const b=botonPromocion(esVerdadero(aviso.urgente)?'⚠️ Quitar urgente':'⚠️ Urgente');
                b.dataset.promocionUrgente='1';
                b.title=esVerdadero(aviso.urgente)?'Quitar urgente':'Marcar como urgente';
                b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();alternarUrgente(id,b);});
                acciones.appendChild(b);
            }
            fila.dataset.promocionesReady='1';
        });
    }

    function instalar(){
        actualizarVisibilidadFormularios();

        if(typeof window.editarAviso==='function' && !window.__promocionesEditarPatched){
            const original=window.editarAviso;
            window.editarAviso=function(id){
                const r=original.apply(this,arguments);
                setTimeout(()=>sincronizarEdicion(id),0);
                setTimeout(()=>sincronizarEdicion(id),200);
                setTimeout(actualizarVisibilidadFormularios,250);
                return r;
            };
            window.__promocionesEditarPatched=true;
        }

        if(window.API && typeof window.API.peticion==='function' && !window.API.__promocionesCreatePatched){
            const originalPeticion=window.API.peticion.bind(window.API);
            window.API.peticion=async function(accion,payload,apiKey){
                if(accion==='CREAR' && payload?.coleccion==='AVISOS' && payload?.datos && esAdmin()){
                    const form=document.getElementById('form-aviso');
                    const urgente=buscarCheckbox(form,'urgente');
                    const destacado=buscarCheckbox(form,'destacado');
                    payload={...payload,datos:{...payload.datos,urgente:!!urgente?.checked,destacado:!!destacado?.checked}};
                    console.log('🔐 PROMOCIONES ADMIN: payload CREAR',{urgente:!!urgente?.checked,destacado:!!destacado?.checked});
                }
                return originalPeticion(accion,payload,apiKey);
            };
            window.API.__promocionesCreatePatched=true;
        }

        prepararTabla();
        console.log('✅ PROMOCIONES ADMIN: interfaz sincronizada con Supabase.');
        return true;
    }

    function arrancar(){
        instalar();
        let ciclos=0;
        const timer=setInterval(()=>{
            ciclos++;
            actualizarVisibilidadFormularios();
            prepararTabla();
            if(ciclos>=30) clearInterval(timer);
        },1000);
        const observer=new MutationObserver(()=>{actualizarVisibilidadFormularios();prepararTabla();});
        observer.observe(document.body,{childList:true,subtree:true});
        setTimeout(()=>observer.disconnect(),35000);
    }

    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',arrancar,{once:true});
    else arrancar();
    window.alternarUrgenteAdmin=alternarUrgente;
})();