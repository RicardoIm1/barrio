// ============================================================== 
// ADMIN.JS
// ============================================================== 
console.log('ℹ️ admin.js: controlador embebido de admin.html activo.');

(function inicializarPerfilAdmin() {
    const escapar = valor => { const div=document.createElement('div'); div.textContent=valor==null?'':String(valor); return div.innerHTML; };
    const formatearFecha = valor => { if(!valor)return 'No disponible'; const fecha=new Date(valor); if(Number.isNaN(fecha.getTime()))return String(valor); return fecha.toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'}); };
    function mostrarPerfil(p){
        const contenedor=document.getElementById('perfil-info'); if(!contenedor)return; p=p||{};
        const nombre=p.nombre||p.name||'Usuario', email=p.email||'No disponible', rol=p.rol||'usuario', telefono=p.telefono||'No registrado';
        const categorias=Array.isArray(p.categorias)?p.categorias.join(', '):(p.categorias||'No registradas');
        contenedor.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;">
        <div class="campo"><label>Nombre</label><div>${escapar(nombre)}</div></div><div class="campo"><label>Correo electrónico</label><div>${escapar(email)}</div></div>
        <div class="campo"><label>Rol</label><div>${escapar(rol)}</div></div><div class="campo"><label>Teléfono</label><div>${escapar(telefono)}</div></div>
        <div class="campo"><label>Categorías</label><div>${escapar(categorias)}</div></div><div class="campo"><label>Estado</label><div>${p.activo===false?'Inactivo':'Activo'}</div></div>
        <div class="campo"><label>Fecha de registro</label><div>${escapar(formatearFecha(p.fecha_registro))}</div></div><div class="campo"><label>Último acceso</label><div>${escapar(formatearFecha(p.ultimo_acceso))}</div></div>
        <div class="campo"><label>Puntos de confianza</label><div>${escapar(p.puntos_confianza??0)}</div></div><div class="campo"><label>Nivel</label><div>${escapar(p.nivel||'Sin nivel')}</div></div>
        <div class="campo"><label>Avisos publicados</label><div>${escapar(p.avisos_publicados??0)}</div></div><div class="campo"><label>Reportes recibidos</label><div>${escapar(p.reportes_recibidos??0)}</div></div></div>`;
    }
    async function cargarPerfil(){
        const contenedor=document.getElementById('perfil-info'); if(!contenedor)return;
        try{const local=JSON.parse(localStorage.getItem('usuario')||'null');if(local)mostrarPerfil(local);}catch(e){console.warn('⚠️ No se pudo leer el perfil local:',e);}
        if(!window.supabaseClient)return;
        try{const {data:authData,error:authError}=await window.supabaseClient.auth.getUser();if(authError||!authData?.user?.id)return;
            const {data,error}=await window.supabaseClient.from('usuarios').select(`id,email,nombre,rol,categorias,activo,telefono,fecha_registro,ultimo_acceso,puntos_confianza,nivel,avisos_publicados,reportes_recibidos,reportes_realizados,votos_positivos_recibidos,votos_negativos_recibidos,fecha_verificacion,sancion_hasta`).eq('id',authData.user.id).maybeSingle();
            if(error){console.error('❌ Error cargando perfil desde Supabase:',error);return;} if(data)mostrarPerfil(data);
        }catch(error){console.error('❌ Error inesperado cargando perfil:',error);}
    }
    window.cargarPerfilAdmin=cargarPerfil;
})();

(function inicializarPestanasAdmin(){
    function activarPestana(tabName){const botones=document.querySelectorAll('#admin-tabs .filtro[data-tab]'),paneles=document.querySelectorAll('.tab');if(!tabName)return;botones.forEach(btn=>btn.classList.toggle('activo',btn.dataset.tab===tabName));paneles.forEach(panel=>panel.classList.toggle('activo',panel.id===`tab-${tabName}`));if(tabName==='perfil'&&typeof window.cargarPerfilAdmin==='function')window.cargarPerfilAdmin();console.log(`📑 Pestaña admin activa: ${tabName}`);}
    function instalar(){const contenedor=document.getElementById('admin-tabs');if(!contenedor)return false;contenedor.addEventListener('click',event=>{const boton=event.target.closest('.filtro[data-tab]');if(!boton||!contenedor.contains(boton))return;event.preventDefault();activarPestana(boton.dataset.tab);});const inicial=contenedor.querySelector('.filtro.activo[data-tab]');if(inicial)activarPestana(inicial.dataset.tab);console.log('✅ Navegación de pestañas admin instalada.');return true;}
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',instalar,{once:true});else instalar();
})();

(function inicializarCreacionAviso(){
    const valor=id=>{const e=document.getElementById(id);return e?String(e.value||'').trim():'';};
    async function crearAviso(event){event.preventDefault();event.stopImmediatePropagation();const titulo=valor('titulo'),contenido=valor('contenido'),categoria=valor('categoria')||'varios';if(!titulo)return alert('❌ El título del aviso es obligatorio.');if(!contenido)return alert('❌ La descripción del aviso es obligatoria.');const datos={titulo,contenido,categoria,ubicacion:valor('ubicacion'),contacto:valor('contacto'),destacado:false,status:'activo'};const fechaEvento=valor('fecha_evento');if(fechaEvento)datos.fecha_evento=fechaEvento;const imagenUrl=valor('imagen_url');if(imagenUrl)datos.imagen_url=imagenUrl;const videoUrl=valor('video_url');if(videoUrl)datos.video_url=videoUrl;try{const apiKey=localStorage.getItem('api_key'),usuario=API.getUsuarioActual();if(!apiKey||!usuario?.id)throw new Error('Sesión de usuario no disponible. Vuelve a iniciar sesión.');const resultado=await API.peticion('CREAR',{coleccion:'AVISOS',datos},apiKey);if(!resultado?.success)throw new Error(resultado?.error||'Supabase rechazó la creación del aviso.');console.log('✅ CREAR AVISO: registro creado:',resultado.data);alert('✅ Aviso publicado correctamente');const form=document.getElementById('form-aviso');if(form)form.reset();window.location.reload();}catch(error){console.error('❌ CREAR AVISO: error:',error);alert('❌ No se pudo publicar el aviso: '+(error?.message||error));}}
    function instalar(){const form=document.getElementById('form-aviso');if(!form)return false;form.addEventListener('submit',crearAviso,true);console.log('✅ CREAR AVISO: handler Supabase instalado en #form-aviso.');return true;}
    function intentar(){if(instalar())return;setTimeout(instalar,500);} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',intentar,{once:true});else intentar();
})();

(function inicializarEdicionAviso(){
    function instalar(){const original=document.getElementById('form-editar');if(!original||original.dataset.supabaseEditReady==='1')return!!original;const form=original.cloneNode(true);form.removeAttribute('onsubmit');form.dataset.supabaseEditReady='1';original.replaceWith(form);
        form.addEventListener('submit',async event=>{event.preventDefault();event.stopImmediatePropagation();const obtener=id=>document.getElementById(id),valor=id=>{const el=obtener(id);return el?String(el.value||'').trim():'';},id=valor('edit-id');if(!id)return alert('❌ No se encontró el ID del aviso.');const datos={titulo:valor('edit-titulo'),contenido:valor('edit-contenido'),ubicacion:valor('edit-ubicacion'),contacto:valor('edit-contacto'),imagen_url:valor('edit-imagen_url'),video_url:valor('edit-video_url')};const fecha=valor('edit-fecha_evento');if(fecha)datos.fecha_evento=fecha.split('T')[0];const chk=obtener('edit-destacado');if(chk)datos.destacado=!!chk.checked;try{const apiKey=localStorage.getItem('api_key');console.log('✏️ ACTUALIZAR AVISO: enviando:',{id,datos});const resultado=await API.peticion('ACTUALIZAR',{coleccion:'AVISOS',id,datos},apiKey);if(!resultado?.success)throw new Error(resultado?.error||'No se pudo actualizar el aviso.');alert('✅ Aviso actualizado correctamente');const modal=document.getElementById('modal-editar');if(modal)modal.style.display='none';location.reload();}catch(error){console.error('❌ ACTUALIZAR AVISO:',error);alert('❌ Error al actualizar: '+(error?.message||error));}},true);console.log('✅ EDICIÓN AVISO: formulario legacy aislado y handler Supabase instalado.');return true;}
    function intentar(){if(instalar())return;setTimeout(instalar,1000);}setTimeout(intentar,0);
})();

(function ocultarAvisosEliminadosAdmin(){let instalado=false,intentos=0;function instalarFiltro(){if(instalado)return true;if(typeof window.renderizarTablaAvisos!=='function'){intentos++;if(intentos>=100){console.warn('⚠️ No se pudo instalar el filtro de avisos eliminados.');return true;}return false;}const original=window.renderizarTablaAvisos;window.renderizarTablaAvisos=function(){if(Array.isArray(todosLosAvisos))todosLosAvisos=todosLosAvisos.filter(a=>a?.status!=='eliminado');return original.apply(this,arguments);};instalado=true;return true;}const timer=setInterval(()=>{if(instalarFiltro())clearInterval(timer);},100);setTimeout(()=>clearInterval(timer),10000);})();

(function aislarEstilosAdmin(){function instalar(){document.querySelectorAll('link[rel="stylesheet"]').forEach(hoja=>{const href=hoja.getAttribute('href')||'';if(href==='/css/index2.css'||href.endsWith('/css/index2.css'))hoja.remove();});}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',instalar,{once:true});else instalar();})();

// ============================================================== 
// MÉTRICAS DEL DASHBOARD ADMIN
// Un único sistema de datos, sin paneles estadísticos duplicados.
// ============================================================== 
(function inicializarMetricasAdmin(){
    if(window.__ELBARRIO_METRICAS_ADMIN_INICIADAS__)return;
    window.__ELBARRIO_METRICAS_ADMIN_INICIADAS__=true;
    let timer=null;
    let ultimoDatos=null;
    let cargando=false;
    let sesionAdminLista=false;
    const DIAS=30;

    async function asegurarSesionAdmin(){
        if(sesionAdminLista)return true;
        if(!window.Auth||typeof window.Auth.requireAuth!=='function')throw new Error('Sistema de autenticación no disponible.');
        const usuario=await window.Auth.requireAuth();
        if(!usuario?.id)throw new Error('Sesión de administrador no disponible.');
        sesionAdminLista=true;
        console.log('🔐 Sesión admin confirmada antes de cargar métricas:',usuario.id);
        return true;
    }
    const numero=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
    const formatear=v=>numero(v).toLocaleString('es-MX');
    const escapar=v=>{const d=document.createElement('div');d.textContent=v==null?'':String(v);return d.innerHTML;};

    function actualizar(id,v){const e=document.getElementById(id);if(e)e.textContent=formatear(v);}
    function fechas30(){const r=[],hoy=new Date();hoy.setHours(0,0,0,0);for(let i=DIAS-1;i>=0;i--){const d=new Date(hoy);d.setDate(hoy.getDate()-i);r.push(d);}return r;}
    function clave(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
    function etiqueta(d){return d.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit'});}

    function canvasSize(canvas){if(!canvas)return null;const rect=canvas.getBoundingClientRect(),ratio=window.devicePixelRatio||1,w=Math.max(320,Math.floor(rect.width||700)),h=200;canvas.width=w*ratio;canvas.height=h*ratio;const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);return{ctx,w,h};}
    function lineChart(canvas,labels,values){const size=canvasSize(canvas);if(!size)return;const{ctx,w,h}=size;ctx.clearRect(0,0,w,h);const pad={l:42,r:18,t:20,b:38},cw=w-pad.l-pad.r,ch=h-pad.t-pad.b,max=Math.max(1,...values),steps=4;ctx.font='11px system-ui';ctx.textAlign='right';ctx.textBaseline='middle';for(let i=0;i<=steps;i++){const y=pad.t+ch-(ch*i/steps),v=max*i/steps;ctx.strokeStyle='rgba(255,255,255,.10)';ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillStyle='#888';ctx.fillText(Math.round(v).toLocaleString('es-MX'),pad.l-7,y);}const pts=values.map((v,i)=>{const x=pad.l+(labels.length===1?cw/2:cw*i/(labels.length-1)),y=pad.t+ch-(v/max)*ch;return{x,y};});ctx.strokeStyle='#f5b042';ctx.lineWidth=3;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();pts.forEach(p=>{ctx.fillStyle='#f5b042';ctx.beginPath();ctx.arc(p.x,p.y,3.5,0,Math.PI*2);ctx.fill();});ctx.fillStyle='#888';ctx.textAlign='center';ctx.textBaseline='top';labels.forEach((l,i)=>{if(i%5===0||i===labels.length-1){const x=pad.l+(labels.length===1?cw/2:cw*i/(labels.length-1));ctx.fillText(l,x,h-pad.b+9);}});}

    function renderCategorias(avisos){
        const panel=document.getElementById('chartCategorias'),cont=document.getElementById('chartBars'),mini=document.getElementById('chartStatsMini');
        if(!panel||!cont)return;
        const mapa=new Map();avisos.forEach(a=>{const c=String(a.categoria||'varios').trim()||'varios';mapa.set(c,(mapa.get(c)||0)+1);});
        const arr=[...mapa.entries()].sort((a,b)=>b[1]-a[1]);
        const max=Math.max(1,...arr.map(x=>x[1]));
        cont.innerHTML=arr.map(([categoria,cantidad])=>`<div class="bar-item"><span class="bar-label">${escapar(categoria)}</span><div class="bar-container"><div class="bar-fill" style="width:${(cantidad/max)*100}%">${cantidad}</div></div><span class="bar-count">${cantidad}</span></div>`).join('');
        panel.style.display='block';
        if(mini)mini.textContent=`${mapa.size} categorías con avisos · ${formatear(avisos.length)} avisos no eliminados`;
        actualizar('totalCategorias',mapa.size);
    }

    function renderDiarios(usuarios,avisos){
        const fechas=fechas30(),labels=fechas.map(etiqueta),mapU=new Map(),mapA=new Map();
        usuarios.forEach(x=>{if(x.fecha_registro){const k=clave(new Date(x.fecha_registro));mapU.set(k,(mapU.get(k)||0)+1);}});
        avisos.forEach(x=>{if(x.created_at){const k=clave(new Date(x.created_at));mapA.set(k,(mapA.get(k)||0)+1);}});
        const u=fechas.map(d=>mapU.get(clave(d))||0),a=fechas.map(d=>mapA.get(clave(d))||0);
        const panelU=document.getElementById('chartUsuariosDiarios'),panelA=document.getElementById('chartAvisosDiarios');
        if(panelU){panelU.style.display='block';lineChart(document.getElementById('chartUsuariosCanvas'),labels,u);const s=document.getElementById('usuariosStats');if(s)s.textContent=`Total en periodo: ${formatear(u.reduce((s,v)=>s+v,0))}`;}
        if(panelA){panelA.style.display='block';lineChart(document.getElementById('chartAvisosCanvas'),labels,a);const s=document.getElementById('avisosStats');if(s)s.textContent=`Total en periodo: ${formatear(a.reduce((s,v)=>s+v,0))}`;}
        const conexiones=document.getElementById('chartConexionesDiarias');if(conexiones)conexiones.style.display='none';
    }

    function renderOnlineUsers(usuariosOnline){
        const panel=document.getElementById('chartOnline'),lista=document.getElementById('onlineUsersList'),badge=document.getElementById('onlineCount');
        if(!panel||!lista||!badge)return;
        panel.style.display='block';
        badge.textContent=`${usuariosOnline.length} ${usuariosOnline.length===1?'conectado':'conectados'}`;
        if(!usuariosOnline.length){lista.innerHTML='<p style="color:#888;margin:0;padding:12px 0;">No hay usuarios conectados en este momento.</p>';return;}
        lista.innerHTML=usuariosOnline.map(u=>{const nombre=escapar(u.nombre||'Usuario'),email=escapar(u.email||''),fecha=u.ultima_actividad?new Date(u.ultima_actividad):null,tiempo=fecha&&!Number.isNaN(fecha.getTime())?fecha.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}):'ahora';return `<div class="online-user-item"><div><strong style="color:#eee;">${nombre}</strong>${email?`<div class="online-user-email">${email}</div>`:''}</div><span class="online-user-time">● ${tiempo}</span></div>`;}).join('');
    }

    function actualizarResumen(totalUsuarios,avisosPeriodo){
        const resumen=document.getElementById('statsSummary');if(!resumen)return;
        resumen.style.display='flex';
        const promU=document.getElementById('promUsuarios'),promA=document.getElementById('promAvisos'),totalU=document.getElementById('totalUsuarios');
        if(promU)promU.textContent=(totalUsuarios/DIAS).toFixed(1);
        if(promA)promA.textContent=(avisosPeriodo/DIAS).toFixed(1);
        if(totalU)totalU.textContent=formatear(totalUsuarios);
    }

    async function cargar(){
        const footer=document.querySelector('.dashboard-footer');
        if(!footer||typeof getSupabaseClient!=='function')return;
        if(cargando)return;
        try{await asegurarSesionAdmin();}catch(error){console.error('❌ Admin: sesión no lista para métricas:',error);const badge=document.getElementById('onlineCount');if(badge)badge.textContent='No disponible';return;}
        cargando=true;
        try{
            const client=await getSupabaseClient();
            const [ur,ar,vr,or]=await Promise.all([
                client.from('usuarios').select('id,fecha_registro,ultimo_acceso').range(0,9999),
                client.from('avisos').select('id,titulo,categoria,created_at,status,vistas').range(0,9999),
                client.rpc('obtener_resumen_votos_admin'),
                client.rpc('obtener_usuarios_en_linea_admin')
            ]);
            if(ur.error)throw ur.error;if(ar.error)throw ar.error;if(vr.error)throw vr.error;if(or.error)throw or.error;
            const usuarios=ur.data||[],avisos=(ar.data||[]).filter(a=>a.status!=='eliminado');
            const votosRaw=typeof vr.data==='string'?JSON.parse(vr.data):(vr.data||{}),onlineRaw=typeof or.data==='string'?JSON.parse(or.data):(or.data||{});
            const pos=numero(votosRaw.positivos),neg=numero(votosRaw.negativos),votos=numero(votosRaw.total??(pos+neg));
            const usuariosOnline=Array.isArray(onlineRaw)?onlineRaw:(Array.isArray(onlineRaw.usuarios)?onlineRaw.usuarios:[]);
            const totalUsuarios=usuarios.length,totalAvisos=avisos.length,activos=avisos.filter(a=>a.status==='activo').length,pendientes=avisos.filter(a=>a.status==='pendiente').length,totalVistas=avisos.reduce((s,a)=>s+numero(a.vistas),0),fechaCorte=Date.now()-DIAS*24*60*60*1000,avisosPeriodo=avisos.filter(a=>{const d=new Date(a.created_at);return !Number.isNaN(d.getTime())&&d.getTime()>=fechaCorte;}).length;
            actualizar('totalAvisos',totalAvisos);actualizar('avisosActivos',activos);actualizar('avisosPendientes',pendientes);actualizar('totalVisitas',totalVistas);actualizar('totalInteracciones',votos);actualizar('totalUsuarios',totalUsuarios);
            const card=document.getElementById('pendingCard');if(card)card.style.display=pendientes>0?'flex':'none';
            const cards=document.querySelectorAll('.dashboard-footer .stat-card');cards.forEach(card=>{const t=card.querySelector('h4'),l=card.querySelector('.stat-label');if(!t)return;const txt=t.textContent.trim().toLowerCase();if(txt==='interacciones'||txt==='votos registrados'){t.textContent='Votos registrados';if(l)l.textContent='positivos + negativos';}if(txt==='total visitas'||txt==='alcance'){t.textContent='Alcance';if(l)l.textContent='vistas acumuladas';}});
            renderCategorias(avisos);renderDiarios(usuarios,avisos);renderOnlineUsers(usuariosOnline);actualizarResumen(totalUsuarios,avisosPeriodo);ultimoDatos={usuarios,avisos,usuariosOnline};
            console.log('📊 Dashboard admin actualizado:',{totalUsuarios,totalAvisos,activos,pendientes,totalVistas,pos,neg,votos,usuariosOnline:usuariosOnline.length});
        }catch(error){console.error('❌ No se pudieron cargar las métricas del panel admin:',error);const badge=document.getElementById('onlineCount');if(badge)badge.textContent='No disponible';}
        finally{cargando=false;}
    }

    function observar(){
        const contenedor=document.getElementById('footer-container');if(!contenedor)return;
        const iniciar=()=>{if(!document.querySelector('.dashboard-footer'))return;if(!timer)timer=setInterval(cargar,15000);cargar();};
        const obs=new MutationObserver(()=>{if(document.querySelector('.dashboard-footer')){obs.disconnect();iniciar();}});
        obs.observe(contenedor,{childList:true,subtree:true});iniciar();
        window.addEventListener('resize',()=>{if(!ultimoDatos)return;renderDiarios(ultimoDatos.usuarios,ultimoDatos.avisos);renderCategorias(ultimoDatos.avisos);renderOnlineUsers(ultimoDatos.usuariosOnline||[]);});
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observar,{once:true});else observar();
})();

// ===== JAVASCRIPT MIGRADO DESDE admin.html =====
// ==================== CONTROL DE ACCESO ====================
        (function verificarAcceso() {
            const usuario = API.getUsuarioActual();
            const apiKey = localStorage.getItem('api_key');

            // Si no hay sesión, redirigir al login
            if (!usuario || !apiKey) {
                console.warn('🔒 Acceso denegado: No hay sesión activa');
                window.location.href = '/login.html?redirect=admin.html';
                return;
            }

            // ✅ Permitir acceso a ambos roles (admin y usuario normal)
            console.log(`✅ Acceso concedido como: ${usuario.rol} - ${usuario.email}`);

            // Solo mostrar la pestaña de usuarios si es admin
            if (usuario.rol === 'admin') {
                const tabUsuarios = document.getElementById('tab-usuarios-btn');
                if (tabUsuarios) tabUsuarios.style.display = 'block';
                console.log('👥 Pestaña de usuarios visible para admin');
            } else {
                console.log('👤 Usuario normal: solo verá sus propios avisos');
            }
        })();

// INICIALIZAR MODAL - Ejecutar cuando el DOM esté listo
        document.addEventListener('DOMContentLoaded', function () {
            const modal = document.getElementById('modal-editar');
            const cerrarBtn = document.getElementById('cerrar-modal');
            const cancelarBtn = document.getElementById('cancelar-editar');
            const form = document.getElementById('form-editar');

            // Cerrar modal
            if (cerrarBtn) {
                cerrarBtn.onclick = function () {
                    if (modal) modal.style.display = 'none';
                };
            }
            if (cancelarBtn) {
                cancelarBtn.onclick = function () {
                    if (modal) modal.style.display = 'none';
                };
            }

            // Cerrar al hacer clic fuera del modal
            if (modal) {
                modal.onclick = function (e) {
                    if (e.target === modal) modal.style.display = 'none';
                };
            }

            // Manejar envío del formulario
            if (form) {
                form.onsubmit = async function (e) {
                    e.preventDefault();
                    const id = document.getElementById('edit-id').value;
                    const datos = {
                        titulo: document.getElementById('edit-titulo').value,
                        contenido: document.getElementById('edit-contenido').value,
                        ubicacion: document.getElementById('edit-ubicacion').value,
                        contacto: document.getElementById('edit-contacto').value,
                        fecha_evento: document.getElementById('edit-fecha_evento').value,
                        imagen_url: document.getElementById('edit-imagen_url').value,
                        video_url: document.getElementById('edit-video_url').value,
                        urgente: document.getElementById('edit-urgente').checked,
                        destacado: document.getElementById('edit-destacado').checked
                    };

                    try {
                        const apiKey = localStorage.getItem('api_key');
                        const resultado = await API.peticion('ACTUALIZAR', {
                            coleccion: 'AVISOS',
                            id: id,
                            datos: datos
                        }, apiKey);

                        if (resultado && resultado.success) {
                            alert('✅ Aviso actualizado correctamente');
                            modal.style.display = 'none';
                            location.reload();
                        } else {
                            alert('❌ Error: ' + (resultado.error || 'No se pudo actualizar'));
                        }
                    } catch (error) {
                        alert('❌ Error: ' + error.message);
                    }
                };
            }
        });

// ==================== ADMINISTRACIÓN - CONEXIÓN REAL CON TU API ====================

        // Variables globales
        let todosLosAvisos = [];
        let filtroCategoriaActual = 'todos';
        let filtroStatusActual = 'todos';

        // Función de escape HTML (existente)
        function escapeHTML(str) {
            if (!str) return '';
            return String(str).replace(/[&<>]/g, function (m) {
                if (m === '&') return '&amp;';
                if (m === '<') return '&lt;';
                if (m === '>') return '&gt;';
                return m;
            });
        }

        // Helper para íconos de categoría
        function getCategoriaIcono(categoria) {
            const iconos = {
                'urgente': '🚨',
                'escuelas': '🏫',
                'servicios': '🛠️',
                'comercios': '🛒',
                'eventos': '📅',
                'gobierno': '🏛️',
                'varios': '📢'
            };
            return iconos[categoria] || '📢';
        }

        // ==================== CARGAR AVISOS REALES DESDE TU API ====================
        async function cargarAvisosParaAdmin() {
            const tbody = document.getElementById('tabla-avisos-cuerpo');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 15px;">🔄 Cargando avisos...</td></tr>';
            }

            try {
                const apiKey = localStorage.getItem('api_key');
                const usuario = API.getUsuarioActual();

                if (!apiKey || !usuario) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 15px; color: #ff8c42;">⚠️ Necesitas iniciar sesión</td></tr>';
                    return;
                }

                console.log(`👤 Usuario logueado: ${usuario.rol} - ${usuario.email}`);

                // ✅ Para admin: obtener TODOS los avisos (sin paginación)
                // Para usuario normal: solo sus avisos
                let respuesta;
                if (usuario.rol === 'admin') {
                    // Intentar obtener todos los avisos (sin límite)
                    respuesta = await API.peticion('LISTAR_TODOS_AVISOS', {}, apiKey);
                    console.log('📡 Respuesta API:', respuesta);
                    console.log('📦 Datos:', respuesta?.data);
                    console.log('📦 Datos.datos:', respuesta?.data?.datos);
                    if (!respuesta || !respuesta.success) {
                        // Si LISTAR_TODOS_AVISOS no existe, usar LISTAR_MIS_AVISOS con páginas
                        respuesta = await API.peticion('LISTAR_MIS_AVISOS', { limite: 1000 }, apiKey);
                    }
                } else {
                    respuesta = await API.peticion('LISTAR_MIS_AVISOS', {}, apiKey);
                }

                console.log('📡 Respuesta de la API:', respuesta);

                let avisos = [];

                if (respuesta && respuesta.success) {
                    if (respuesta.data && respuesta.data.datos && Array.isArray(respuesta.data.datos)) {
                        avisos = respuesta.data.datos;
                    } else if (respuesta.data && Array.isArray(respuesta.data)) {
                        avisos = respuesta.data;
                    } else if (respuesta.datos && Array.isArray(respuesta.datos)) {
                        avisos = respuesta.datos;
                    }
                } else {
                    throw new Error(respuesta?.error || 'Error al obtener avisos');
                }

                if (!avisos || avisos.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 15px;">📭 No tienes avisos registrados aún</td></tr>';
                    todosLosAvisos = [];
                    return;
                }

                // Modificar la parte donde se mapean los avisos en cargarAvisosParaAdmin
                todosLosAvisos = avisos.map(aviso => ({
                    id: aviso.id,
                    titulo: aviso.titulo || 'Sin título',
                    contenido: aviso.contenido || '',
                    categoria: aviso.categoria || 'varios',
                    status: aviso.status || 'pendiente',
                    contacto: aviso.contacto || '',
                    imagen_url: aviso.imagen_url || '',
                    video_url: aviso.video_url || '',
                    ubicacion: aviso.ubicacion || '',
                    fecha_evento: aviso.fecha_evento || '',
                    created_at: aviso.created_at,
                    destacado: aviso.destacado === true || aviso.destacado === 'TRUE' || aviso.destacado === 1 || aviso.destacado === 'true',

                    // === NUEVOS CAMPOS PARA ESTADÍSTICAS ===
                    vistas: aviso.vistas || aviso.visitas || 0,
                    comentarios_count: aviso.comentarios_count || aviso.total_comentarios || 0,
                    votos_positivos: aviso.votos_positivos || aviso.likes || aviso.puntuacion_positiva || 0,
                    votos_negativos: aviso.votos_negativos || aviso.dislikes || aviso.puntuacion_negativa || 0,

                    // Información del autor
                    nombre_autor: aviso.nombre_autor || aviso.autor_nombre || aviso.created_by_nombre,
                    email: aviso.email || aviso.autor_email || aviso.created_by_email
                }));

                console.log(`✅ Cargados ${todosLosAvisos.length} avisos`);
                renderizarTablaAvisos();

            } catch (error) {
                console.error('❌ Error:', error);
                if (tbody) {
                    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 15px; color: red;">❌ ${error.message || 'Error de conexión'}</td></tr>`;
                }
            }
        }

        // ==================== RENDERIZAR TABLA SOLO CON FILTRO DE ESTADO ====================
        function renderizarTablaAvisos() {
            const tbody = document.getElementById('tabla-avisos-cuerpo');
            if (!tbody) return;

            const usuario = API.getUsuarioActual();
            const esAdmin = usuario?.rol === 'admin';

            // Solo filtrar por estado (ya no por categoría)
            let avisosFiltrados = [...todosLosAvisos];

            if (filtroStatusActual !== 'todos') {
                avisosFiltrados = avisosFiltrados.filter(a => a.status === filtroStatusActual);
            }

            if (avisosFiltrados.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 15px;">🔍 No hay avisos que coincidan con los filtros</td></tr>';
                return;
            }

            tbody.innerHTML = avisosFiltrados.map(aviso => {
                const estado = aviso.status || 'pendiente';
                const estadoTexto = estado === 'activo' ? '🟢 Activo' : (estado === 'rechazado' ? '🔴 Rechazado' : '⏳ Pendiente');

                // Obtener nombre del autor (puede venir en diferentes campos)
                const nombreAutor = aviso.nombre_autor || aviso.autor_nombre || aviso.created_by_nombre || 'Vecino';

                // Obtener estadísticas con valores por defecto
                const vistas = aviso.vistas || 0;
                const comentarios = aviso.comentarios_count || aviso.total_comentarios || 0;
                const votosPos = aviso.votos_positivos || aviso.likes || 0;
                const votosNeg = aviso.votos_negativos || aviso.dislikes || 0;

                // Calcular total de votos
                const totalVotos = votosPos + votosNeg;

                // Formatear fecha
                let fechaFormateada = 'Sin fecha';
                if (aviso.created_at) {
                    try {
                        fechaFormateada = new Date(aviso.created_at).toLocaleString('es-MX', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                    } catch (e) {
                        fechaFormateada = aviso.created_at;
                    }
                }

                return `
        <tr data-id="${aviso.id}">
            <td data-label="ID">${aviso.id ? String(aviso.id).substring(0, 8) : 'N/A'}..</td>
            <td data-label="Imagen" style="text-align: center;">
    ${aviso.imagen_url ? `<img src="${aviso.imagen_url}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;" onerror="this.style.display='none'">` : '📷'}
</td>
            <td data-label="Título">
                <strong>${escapeHTML(aviso.titulo || 'Sin título')}</strong><br>
                <div style="font-size: 0.7rem; margin-top: 5px;">
                    <span title="Vistas">🙉 ${vistas}</span>
                    <span style="margin-left: 8px;" title="Comentarios">💬 ${comentarios}</span>
                    <span style="margin-left: 8px;" title="Votos positivos">👍 ${votosPos}</span>
                    <span style="margin-left: 8px;" title="Votos negativos">👎 ${votosNeg}</span>
                    ${totalVotos > 0 ? `<span style="margin-left: 8px;" title="Total de votos">📊 ${totalVotos}</span>` : ''}
                </div>
                <small style="display: block; margin-top: 4px;">📢 VARIOS</small>
                ${aviso.video_url ? '<small>🎥 Video</small>' : ''}
            </td>
            <td data-label="Publicó">
                <strong>👤 ${escapeHTML(nombreAutor)}</strong><br>
                <small>🕒 ${fechaFormateada}</small>
                ${aviso.email ? `<br><small>📧 ${escapeHTML(aviso.email)}</small>` : ''}
            </td>
            <td data-label="Estado">
                ${esAdmin ? `
                <select class="select-estado ${estado}" onchange="cambiarEstadoAviso('${aviso.id}', this.value)">
                    <option value="pendiente" ${estado === 'pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
                    <option value="activo" ${estado === 'activo' ? 'selected' : ''}>🟢 Activo</option>
                    <option value="rechazado" ${estado === 'rechazado' ? 'selected' : ''}>🔴 Rechazado</option>
                </select>
                ` : `<span class="badge-estado badge-${estado}">${estadoTexto}</span>`}
            </td>
            <td data-label="Acciones">
                <div class="acciones-botones">

                    <button class="accion-btn accion-editar"
                        onclick="editarAviso('${aviso.id}')">
                        ✏️ Editar
                    </button>

                    ${esAdmin ? `
                        <button
                            class="accion-btn"
                            style="background:${aviso.destacado ? '#d97706' : '#64748b'};color:white;"
                            onclick="cambiarDestacado('${aviso.id}', ${!aviso.destacado})">
                            ${aviso.destacado ? '⭐ Quitar destacado' : '⭐ Destacar'}
                        </button>

                        <button
                            class="accion-btn accion-eliminar"
                            onclick="eliminarAviso('${aviso.id}')">
                            🗑️ Eliminar
                        </button>
                    ` : ''}

                </div>
            </td>
        </tr>`;
            }).join('');
        }

        // Cambiar estado del aviso
        window.cambiarEstadoAviso = async function (id, nuevoStatus) {
            try {
                const apiKey = localStorage.getItem('api_key');
                const usuario = API.getUsuarioActual();

                if (!apiKey || usuario?.rol !== 'admin') {
                    alert('Solo administradores pueden cambiar el estado');
                    return;
                }

                console.log(`Cambiando aviso ${id} a ${nuevoStatus}`);

                // Usar la misma estructura que funciona en LISTAR_MIS_AVISOS
                const resultado = await API.peticion('ACTUALIZAR', {
                    coleccion: 'AVISOS',
                    id: id,
                    datos: { status: nuevoStatus }
                }, apiKey);

                console.log('Respuesta completa:', resultado);

                if (resultado && resultado.success) {
                    // Actualizar localmente
                    const index = todosLosAvisos.findIndex(a => a.id == id);
                    if (index !== -1) {
                        todosLosAvisos[index].status = nuevoStatus;
                    }
                    renderizarTablaAvisos();
                    alert(`✅ Estado actualizado a: ${nuevoStatus}`);
                } else {
                    alert('❌ La API respondió pero no actualizó: ' + (resultado?.error || 'Error desconocido'));
                }
            } catch (error) {
                console.error('Error detallado:', error);
                alert('❌ Error: ' + error.message);
            }
        };

        // ======================================================
        // DESTACAR / QUITAR DESTACADO
        // ======================================================

        window.cambiarDestacado = async function (id, nuevoValor) {

            try {

                const apiKey = localStorage.getItem('api_key');
                const usuario = API.getUsuarioActual();

                if (!apiKey || usuario?.rol !== 'admin') {
                    alert('Solo administradores pueden destacar avisos');
                    return;
                }

                const accion = nuevoValor ? 'destacar' : 'quitar el destacado';

                if (!confirm(`¿Quieres ${accion} este aviso?`)) {
                    return;
                }

                console.log(`⭐ Cambiando destacado del aviso ${id} a:`, nuevoValor);

                const resultado = await API.peticion('ACTUALIZAR', {
                    coleccion: 'AVISOS',
                    id: id,
                    datos: {
                        destacado: nuevoValor
                    }
                }, apiKey);

                console.log('Respuesta ACTUALIZAR destacado:', resultado);

                if (resultado && resultado.success) {

                    const index = todosLosAvisos.findIndex(a => a.id == id);

                    if (index !== -1) {
                        todosLosAvisos[index].destacado = nuevoValor;
                    }

                    // Mantener también la copia original actualizada
                    const indexOriginal = avisosOriginales.findIndex(a => a.id == id);

                    if (indexOriginal !== -1) {
                        avisosOriginales[indexOriginal].destacado = nuevoValor;
                    }

                    renderizarTablaAvisos();

                    alert(
                        nuevoValor
                            ? '⭐ Aviso destacado correctamente'
                            : 'Aviso retirado de destacados'
                    );

                } else {

                    throw new Error(
                        resultado?.error || 'No se pudo actualizar el destacado'
                    );
                }

            } catch (error) {

                console.error('Error cambiando destacado:', error);

                alert('❌ Error: ' + error.message);
            }
        };

        // Eliminar aviso
        window.eliminarAviso = async function (id) {
            if (!confirm('¿Eliminar este aviso?')) return;

            try {
                const apiKey = localStorage.getItem('api_key');
                const resultado = await API.peticion('ELIMINAR', {
                    coleccion: 'AVISOS',
                    id: id
                }, apiKey);

                if (resultado && resultado.success) {
                    todosLosAvisos = todosLosAvisos.filter(a => a.id != id);
                    renderizarTablaAvisos();
                    alert('✅ Aviso eliminado');
                } else {
                    throw new Error(resultado?.error || 'Error al eliminar');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('❌ Error: ' + error.message);
            }
        };

        // ==================== EDITAR AVISO ====================
        window.editarAviso = function (id) {
            console.log('✏️ Editando aviso con ID:', id);

            const aviso = todosLosAvisos.find(a => a.id == id);
            if (!aviso) {
                console.error('Aviso no encontrado:', id);
                alert('No se encontró el aviso');
                return;
            }

            console.log('Aviso encontrado:', aviso);

            // Verificar que todos los elementos existan antes de asignar valores
            const campos = {
                'edit-id': aviso.id,
                'edit-titulo': aviso.titulo || '',
                'edit-contenido': aviso.contenido || '',
                'edit-ubicacion': aviso.ubicacion || '',
                'edit-contacto': aviso.contacto || '',
                'edit-fecha_evento': aviso.fecha_evento || '',
                'edit-imagen_url': aviso.imagen_url || '',
                'edit-video_url': aviso.video_url || ''
            };

            // Asignar valores a los campos
            for (const [idCampo, valor] of Object.entries(campos)) {
                const elemento = document.getElementById(idCampo);
                if (elemento) {
                    elemento.value = valor;
                    console.log(`✅ Campo ${idCampo} asignado:`, valor);
                } else {
                    console.warn(`⚠️ Campo ${idCampo} no encontrado en el DOM`);
                }
            }

            const chkDestacado = document.getElementById('edit-destacado');

            if (chkDestacado) {

                const esDestacado =
                    aviso.destacado === true ||
                    aviso.destacado === 'TRUE' ||
                    aviso.destacado === 'true' ||
                    aviso.destacado === 1 ||
                    aviso.destacado === '1';

                chkDestacado.checked = esDestacado;
                console.log(`✅ Checkbox urgente: ${esDestacado}`);
            } else {
                console.warn('⚠️ Campo edit-urgente no encontrado');
            }

            // Mostrar vista previa si ya tiene imagen o video
            const vista = document.getElementById('edit-vista-previa');
            if (vista) {
                if (aviso.imagen_url && (aviso.imagen_url.startsWith('http://') || aviso.imagen_url.startsWith('https://'))) {
                    vista.innerHTML = `<img src="${aviso.imagen_url}" style="max-width:100%; max-height:180px; border-radius:12px;">`;
                } else if (aviso.video_url) {
                    let videoEmbed = aviso.video_url;
                    if (aviso.video_url.includes('youtube.com/watch?v=')) {
                        videoEmbed = aviso.video_url.replace('watch?v=', 'embed/');
                    } else if (aviso.video_url.includes('youtu.be/')) {
                        const videoId = aviso.video_url.split('/').pop();
                        videoEmbed = `https://www.youtube.com/embed/${videoId}`;
                    } else if (aviso.video_url.includes('cloudinary.com')) {
                        vista.innerHTML = `<video src="${aviso.video_url}" controls style="max-width:100%; max-height:180px; border-radius:12px;"></video>`;
                    } else {
                        vista.innerHTML = `<iframe src="${videoEmbed}" frameborder="0" allowfullscreen style="width:100%; height:180px; border-radius:12px;"></iframe>`;
                    }
                } else {
                    vista.innerHTML = '';
                }
            } else {
                console.warn('⚠️ edit-vista-previa no encontrado');
            }

            // Mostrar modal
            const modal = document.getElementById('modal-editar');
            if (modal) {
                modal.style.display = 'flex';
                console.log('✅ Modal abierto');
            } else {
                console.error('❌ Modal no encontrado');
                alert('Error: Modal no encontrado');
            }
        }

        /* aqui va el subir img */

        // ==================== INICIALIZACIÓN ====================
        document.addEventListener('DOMContentLoaded', function () {
            // Cargar avisos al iniciar
            setTimeout(cargarAvisosParaAdmin, 500);

            // ✅ Cargar usuarios al iniciar (por si la pestaña de usuarios está visible)
            setTimeout(cargarUsuariosAdmin, 500);

            // Configurar filtros (solo estado)
            const btnFiltros = document.getElementById('aplicar-filtros');
            const filtroStatus = document.getElementById('filtro-status-admin');

            if (btnFiltros) {
                btnFiltros.addEventListener('click', function () {
                    filtroStatusActual = filtroStatus?.value || 'todos';
                    renderizarTablaAvisos();
                });
            }

            if (filtroStatus) {
                filtroStatus.addEventListener('change', function () {
                    filtroStatusActual = this.value;
                    renderizarTablaAvisos();
                });
            }

            // Modal: cerrar
            document.getElementById('cerrar-modal')?.addEventListener('click', () => {
                document.getElementById('modal-editar').style.display = 'none';
            });
            document.getElementById('cancelar-editar')?.addEventListener('click', () => {
                document.getElementById('modal-editar').style.display = 'none';
            });

            // ✅ Cuando se cambie de pestaña, recargar usuarios si es necesario
            const tabs = document.querySelectorAll('.filtro');
            tabs.forEach(btn => {
                btn.addEventListener('click', function () {
                    if (this.dataset.tab === 'usuarios') {
                        cargarUsuariosAdmin();
                    }
                });
            });
        });

        // Cargar header y footer
        if (typeof UI !== 'undefined' && UI.cargarHeader) {
            UI.cargarHeader();
        }

        // Footer
        fetch('/common/footer-admin.html?v=20260903-2')
            .then(response => response.ok ? response.text() : Promise.reject())
            .then(data => {
                const footerContainer = document.getElementById('footer-container');
                if (footerContainer) {
                    footerContainer.innerHTML = data;
                    const yearSpan = footerContainer.querySelector('#copyright-year');
                    if (yearSpan) {
                        yearSpan.innerHTML = `&copy; ${new Date().getFullYear()} - El Barrio. Todos los derechos reservados.`;
                    }
                    const scripts = footerContainer.querySelectorAll('script');
                    scripts.forEach(oldScript => {
                        const newScript = document.createElement('script');
                        newScript.textContent = oldScript.textContent;
                        document.body.appendChild(newScript);
                        oldScript.remove();
                    });
                }
            })
            .catch(() => console.log('Footer no disponible'));

        console.log('✅ Script de administración cargado - Conectado a API real');

// ==================== CARGAR USUARIOS ====================
        async function cargarUsuariosAdmin() {
            const tablaUsuarios = document.getElementById('tabla-usuarios-cuerpo');
            if (!tablaUsuarios) return;

            try {
                const apiKey = localStorage.getItem('api_key');
                const usuario = API.getUsuarioActual();

                if (!apiKey || usuario?.rol !== 'admin') {
                    console.warn('No autorizado para ver usuarios');
                    tablaUsuarios.innerHTML = '<tr><td colspan="6">⚠️ Solo administradores pueden ver esta sección</td></tr>';
                    return;
                }

                tablaUsuarios.innerHTML = '<tr><td colspan="6">🔄 Cargando usuarios...</td></tr>';

                // Intentar diferentes acciones...
                let respuesta = null;
                let accionUsada = '';

                try {
                    respuesta = await API.peticion('LISTAR_USUARIOS', {}, apiKey);
                    accionUsada = 'LISTAR_USUARIOS';
                    console.log('Respuesta LISTAR_USUARIOS:', respuesta);
                } catch (e) {
                    console.log('LISTAR_USUARIOS falló:', e);
                }

                if (!respuesta || !respuesta.success) {
                    try {
                        respuesta = await API.peticion('OBTENER_USUARIOS', {}, apiKey);
                        accionUsada = 'OBTENER_USUARIOS';
                        console.log('Respuesta OBTENER_USUARIOS:', respuesta);
                    } catch (e) {
                        console.log('OBTENER_USUARIOS falló:', e);
                    }
                }

                if (!respuesta || !respuesta.success) {
                    try {
                        respuesta = await API.peticion('LISTAR', { coleccion: 'USUARIOS' }, apiKey);
                        accionUsada = 'LISTAR';
                        console.log('Respuesta LISTAR:', respuesta);
                    } catch (e) {
                        console.log('LISTAR falló:', e);
                    }
                }

                if (!respuesta || !respuesta.success) {
                    tablaUsuarios.innerHTML = `<tr><td colspan="5">❌ No se pudo cargar usuarios. Acción intentada: ${accionUsada}<br>Error: ${respuesta?.error || 'Desconocido'}</td></tr>`;
                    return;
                }

                let usuarios = [];

                if (respuesta.data && respuesta.data.datos && Array.isArray(respuesta.data.datos)) {
                    usuarios = respuesta.data.datos;
                } else if (respuesta.datos && Array.isArray(respuesta.datos)) {
                    usuarios = respuesta.datos;
                } else if (Array.isArray(respuesta.data)) {
                    usuarios = respuesta.data;
                }

                if (!usuarios || usuarios.length === 0) {
                    tablaUsuarios.innerHTML = '<td><td colspan="5">📭 No hay usuarios registrados</td></tr>';
                    return;
                }

                // ========== ✅ ORDENAR: Del más reciente al más antiguo ==========
                usuarios.sort((a, b) => {
                    // Intentar diferentes campos de fecha
                    const fechaA = a.created_at || a.fecha_registro || a.ultimo_acceso || a.fecha_creacion || 0;
                    const fechaB = b.created_at || b.fecha_registro || b.ultimo_acceso || b.fecha_creacion || 0;

                    // Si son strings, convertirlos a Date
                    const fechaAObj = fechaA ? new Date(fechaA) : 0;
                    const fechaBObj = fechaB ? new Date(fechaB) : 0;

                    return fechaBObj - fechaAObj; // Más reciente primero
                });

                const escapeHtml = (str) => {
                    if (!str) return '';
                    return String(str).replace(/[&<>]/g, function (m) {
                        if (m === '&') return '&amp;';
                        if (m === '<') return '&lt;';
                        if (m === '>') return '&gt;';
                        return m;
                    });
                };

                tablaUsuarios.innerHTML = usuarios.map(user => {
                    const email = escapeHtml(user.email || '');
                    const nombre = escapeHtml(user.nombre || email.split('@')[0]);
                    const rol = user.rol === 'admin' ? 'admin' : 'usuario';
                    const activo = user.activo === 'TRUE' || user.activo === true ? '✅ Activo' : '❌ Inactivo';

                    // Opcional: Mostrar fecha de registro como tooltip o columna extra
                    const fechaRegistro = user.created_at || user.fecha_registro || '';
                    const fechaMostrar = fechaRegistro ? new Date(fechaRegistro).toLocaleDateString('es-MX') : '—';

                    return `
            <tr>
                <td data-label="Email">${email}${fechaRegistro ? `<br><small style="color:#888;">📅 ${fechaMostrar}</small>` : ''}</td>
                <td data-label="Nombre">${nombre}</td>
                <td data-label="Rol"><span class="rol-badge ${rol === 'admin' ? 'rol-admin' : 'rol-usuario'}">${rol}</span></td>
                <td data-label="Estado">${activo}</td>
                <td data-label="Acciones">
                    <button class="accion-btn" style="background:#dc3545;color:white;" onclick="eliminarUsuario('${user.id}')">🗑️ Eliminar</button>
                </td>
            </tr>
        `}).join('');

                console.log(`✅ Cargados ${usuarios.length} usuarios (ordenados del más reciente al más antiguo)`);

            } catch (error) {
                console.error('Error cargando usuarios:', error);
                tablaUsuarios.innerHTML = `<tr><td colspan="5">❌ Error: ${error.message}</td></tr>`;
            }
        }

        // Función para eliminar usuario
        window.eliminarUsuario = async function (id) {
            if (!confirm('⚠️ ¿Desactivar este usuario? Podrá ser reactivado más tarde.')) return;

            try {
                const apiKey = localStorage.getItem('api_key');
                const usuario = API.getUsuarioActual();

                // Usar ELIMINAR_USUARIO (coincide con la acción que agregaste en GAS)
                const resultado = await API.peticion('ELIMINAR_USUARIO', {
                    id: id,
                    usuario: usuario
                }, apiKey);

                if (resultado && resultado.success) {
                    alert('✅ Usuario desactivado correctamente');
                    await cargarUsuariosAdmin();
                } else {
                    throw new Error(resultado?.error || 'Error al desactivar usuario');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('❌ Error: ' + error.message);
            }
        };

// ========== CONFIGURACIÓN CLOUDINARY ==========
        const CLOUDINARY_CLOUD_NAME = "dwnmdkido";
        const CLOUDINARY_UPLOAD_PRESET = "barrio_uploads";

        // ========== SUBIR IMAGEN A IMGBB (sigue igual) ==========
        async function subirImagenImgBB(file) {
            const API_KEY_IMGBB = "e62413ac76628956dbce8a7658610d1a";
            const formData = new FormData();
            formData.append("key", API_KEY_IMGBB);
            formData.append("image", file);

            const res = await fetch("https://api.imgbb.com/1/upload", {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            if (data.success) return data.data.url;
            throw new Error(data.error?.message || "Error subiendo imagen");
        }

        // ========== SUBIR VIDEO A CLOUDINARY (NUEVA VERSIÓN) ==========
        async function subirVideoCloudinary(file) {
            // Validar que sea un video
            if (!file.type.startsWith('video/')) {
                throw new Error("El archivo no es un video válido");
            }

            // Validar tamaño (Cloudinary gratis permite hasta 25MB por archivo)
            if (file.size > 25 * 1024 * 1024) {
                throw new Error("El video es demasiado grande. Máximo 25MB");
            }

            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

            // Subir a Cloudinary
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`, {
                method: "POST",
                body: formData
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error?.message || `Error HTTP ${res.status}`);
            }

            const data = await res.json();

            if (data.secure_url) {
                console.log("✅ Video subido a Cloudinary:", data.secure_url);
                return data.secure_url;
            } else {
                throw new Error("No se recibió URL del video");
            }
        }

        // ========== CONFIGURAR INPUT MULTIMEDIA ==========
        const inputMultimedia = document.getElementById('archivo-multimedia');
        const btnImagen = document.getElementById('btn-seleccionar-imagen');
        const btnVideo = document.getElementById('btn-seleccionar-video');
        const vistaPrevia = document.getElementById('vista-previa-multimedia');
        const campoImagenUrl = document.getElementById('imagen_url');
        const campoVideoUrl = document.getElementById('video_url');

        let tipoSeleccionado = '';

        btnImagen.addEventListener('click', () => {
            tipoSeleccionado = 'imagen';
            inputMultimedia.accept = 'image/*';
            inputMultimedia.click();
        });

        btnVideo.addEventListener('click', () => {
            tipoSeleccionado = 'video';
            inputMultimedia.accept = 'video/*';
            inputMultimedia.click();
        });

        inputMultimedia.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Limpiar campos anteriores
            campoImagenUrl.value = '';
            campoVideoUrl.value = '';

            // Mostrar preview local
            vistaPrevia.innerHTML = `<p>🔄 Subiendo archivo... por favor espera</p>`;
            const urlLocal = URL.createObjectURL(file);

            if (tipoSeleccionado === 'imagen') {
                vistaPrevia.innerHTML = `<img src="${urlLocal}" style="max-width:100%; max-height:180px; border-radius:12px;">`;
                try {
                    const urlFinal = await subirImagenImgBB(file);
                    campoImagenUrl.value = urlFinal;
                    vistaPrevia.innerHTML += `<p style="color:green; font-size:12px;">✅ Imagen lista</p>`;
                    if (window.API && API.mostrarExito) API.mostrarExito('✅ Imagen subida correctamente');
                } catch (err) {
                    vistaPrevia.innerHTML += `<p style="color:red; font-size:12px;">❌ Error: ${err.message}</p>`;
                    if (window.API && API.mostrarError) API.mostrarError(err.message);
                }
            }
            else if (tipoSeleccionado === 'video') {
                vistaPrevia.innerHTML = `<video src="${urlLocal}" controls style="max-width:100%; max-height:180px; border-radius:12px;"></video>`;
                vistaPrevia.innerHTML += `<p style="color:#666; font-size:12px;">⏳ Subiendo a Cloudinary... puede tomar unos segundos</p>`;

                try {
                    const urlFinal = await subirVideoCloudinary(file);
                    campoVideoUrl.value = urlFinal;
                    vistaPrevia.innerHTML = `
            <video src="${urlLocal}" controls style="max-width:100%; max-height:180px; border-radius:12px;"></video>
            <p style="color:green; font-size:12px;">✅ Video listo: <a href="${urlFinal}" target="_blank">ver en Cloudinary</a></p>
            `;
                    if (window.API && API.mostrarExito) API.mostrarExito('✅ Video subido correctamente');
                } catch (err) {
                    console.error("Error detallado:", err);
                    vistaPrevia.innerHTML = `
            <video src="${urlLocal}" controls style="max-width:100%; max-height:180px; border-radius:12px;"></video>
            <p style="color:red; font-size:12px;">❌ Error: ${err.message}</p>
            <p style="color:#666; font-size:11px;">Consejo: El video debe ser menor a 25MB</p>
                `;
                    if (window.API && API.mostrarError) API.mostrarError('❌ Error: ' + err.message);
                }
            }

            // Limpiar el input para permitir otra subida
            setTimeout(() => { inputMultimedia.value = ''; }, 1000);
        });

        // Forzar categoría "varios" antes de enviar
        document.getElementById('form-aviso')?.addEventListener('submit', function () {
            document.getElementById('categoria').value = 'varios';
        });

        // También en edición
        document.getElementById('form-editar')?.addEventListener('submit', function () {
            document.getElementById('edit-categoria').value = 'varios';
        });

// Forzar actualización del header para mostrar el nombre del usuario
        (function actualizarHeaderForce() {
            const usuario = API.getUsuarioActual();
            if (usuario && window.actualizarHeaderPorSesion) {
                setTimeout(() => {
                    window.actualizarHeaderPorSesion();
                }, 100);
            }
        })();

// ========== FUNCIONES DEL MODAL DE CATEGORÍAS ==========
        function abrirModalCategorias() {
            const modal = document.getElementById('modalCategorias');
            if (modal) {
                modal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            } else {
                console.warn('Modal no encontrado');
            }
        }

        function cerrarModalCategorias() {
            const modal = document.getElementById('modalCategorias');
            if (modal) {
                modal.style.display = 'none';
                document.body.style.overflow = '';
            }
        }

        // Cerrar modal al hacer click fuera del contenido
        document.addEventListener('click', function (event) {
            const modal = document.getElementById('modalCategorias');
            if (modal && modal.style.display === 'flex') {
                if (event.target === modal) {
                    cerrarModalCategorias();
                }
            }
        });

// ========== BUSCADOR UNIVERSAL (VERSIÓN MEJORADA) ==========
        let busquedaActual = '';
        let avisosOriginales = [];
        let usuariosOriginales = [];

        function buscarEnAviso(aviso, termino) {
            const texto = termino.toLowerCase();
            const campos = [
                aviso.titulo,
                aviso.contenido,
                aviso.categoria,
                aviso.contacto,
                aviso.ubicacion,
                aviso.id,
                aviso.created_by,
                aviso.email,
                aviso.status,
                aviso.fecha_evento
            ];
            return campos.some(campo => campo && campo.toString().toLowerCase().includes(texto));
        }

        function buscarEnUsuario(usuario, termino) {
            const texto = termino.toLowerCase();
            const campos = [
                usuario.email,
                usuario.nombre,
                usuario.rol,
                usuario.id,
                usuario.telefono,
                usuario.direccion
            ];
            return campos.some(campo => campo && campo.toString().toLowerCase().includes(texto));
        }

        function actualizarResultadosBusqueda(texto, total) {
            const resultadosDiv = document.getElementById('resultados-busqueda');
            if (!resultadosDiv) return;

            if (texto && total !== undefined) {
                resultadosDiv.innerHTML = `<span>🔍 ${total} resultado${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''} para "${escapeHTML(texto)}"</span>`;
                resultadosDiv.style.display = 'block';
            } else {
                resultadosDiv.style.display = 'none';
            }
        }

        function aplicarBusqueda() {
            const input = document.getElementById('buscadorAdmin');
            const texto = input.value.trim();
            busquedaActual = texto;

            const limpiarBtn = document.getElementById('limpiarBusqueda');
            if (limpiarBtn) limpiarBtn.style.display = texto ? 'block' : 'none';

            const tabActivo = document.querySelector('.tab.activo');
            const esTabAvisos = tabActivo && tabActivo.id === 'tab-lista';
            const esTabUsuarios = tabActivo && tabActivo.id === 'tab-usuarios';

            if (!texto) {
                // Restaurar según la pestaña activa
                if (esTabAvisos && avisosOriginales.length) {
                    todosLosAvisos = [...avisosOriginales];
                    renderizarTablaAvisos();
                }
                if (esTabUsuarios && usuariosOriginales.length) {
                    awaitOriginalCargarUsuarios();
                }
                actualizarResultadosBusqueda('', 0);
                return;
            }

            // Buscar según pestaña activa
            if (esTabAvisos && avisosOriginales.length) {
                const avisosFiltrados = avisosOriginales.filter(a => buscarEnAviso(a, texto));
                todosLosAvisos = [...avisosFiltrados];
                renderizarTablaAvisos();
                actualizarResultadosBusqueda(texto, avisosFiltrados.length);
            }
            else if (esTabUsuarios && usuariosOriginales.length) {
                const usuariosFiltrados = usuariosOriginales.filter(u => buscarEnUsuario(u, texto));
                const tablaUsuarios = document.getElementById('tabla-usuarios-cuerpo');
                if (tablaUsuarios) {
                    if (usuariosFiltrados.length === 0) {
                        tablaUsuarios.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px;">🔍 No se encontraron usuarios que coincidan con "${escapeHTML(texto)}"</td></tr>`;
                    } else {
                        const escapeHtml = (str) => {
                            if (!str) return '';
                            return String(str).replace(/[&<>]/g, m => m === '&' ? '&amp;' : (m === '<' ? '&lt;' : '&gt;'));
                        };
                        tablaUsuarios.innerHTML = usuariosFiltrados.map(user => `
                <tr>
                    <td data-label="Email">${escapeHtml(user.email || '')}</td>
                    <td data-label="Nombre">${escapeHtml(user.nombre || '')}</td>
                    <td data-label="Rol"><span class="rol-badge ${user.rol === 'admin' ? 'rol-admin' : 'rol-usuario'}">${user.rol || 'usuario'}</span></td>
                    <td data-label="Estado">${user.activo === 'TRUE' ? '✅ Activo' : '❌ Inactivo'}</td>
                    <td data-label="Acciones">
                        <button class="accion-btn" style="background:#dc3545;color:white;" onclick="eliminarUsuario('${user.id}')">🗑️ Eliminar</button>
                    </td>
                </tr>
            `).join('');
                    }
                }
                actualizarResultadosBusqueda(texto, usuariosFiltrados.length);
            }
        }

        function limpiarBusqueda() {
            const input = document.getElementById('buscadorAdmin');
            if (input) {
                input.value = '';
                aplicarBusqueda();
            }
        }

        function guardarCopiasOriginales() {
            // Guardar avisos
            if (todosLosAvisos.length && avisosOriginales.length === 0) {
                avisosOriginales = [...todosLosAvisos];
            }

            // Guardar usuarios desde la tabla
            const tabla = document.getElementById('tabla-usuarios-cuerpo');
            if (tabla && usuariosOriginales.length === 0) {
                const filas = tabla.querySelectorAll('tr');
                const usuarios = [];
                for (let i = 0; i < filas.length; i++) {
                    const celdas = filas[i].querySelectorAll('td');
                    if (celdas.length >= 5 && !filas[i].querySelector('td[colspan]')) {
                        usuarios.push({
                            email: celdas[0]?.textContent?.split('📅')[0]?.trim() || '',
                            nombre: celdas[1]?.textContent || '',
                            rol: celdas[2]?.textContent?.includes('admin') ? 'admin' : 'usuario',
                            activo: celdas[3]?.textContent?.includes('Activo') ? 'TRUE' : 'FALSE',
                            id: celdas[4]?.querySelector('button')?.getAttribute('onclick')?.match(/'([^']+)'/)?.[1] || ''
                        });
                    }
                }
                if (usuarios.length) usuariosOriginales = usuarios;
            }
        }

        // Función auxiliar para recargar usuarios originales
        async function awaitOriginalCargarUsuarios() {
            if (usuariosOriginales.length) {
                const tablaUsuarios = document.getElementById('tabla-usuarios-cuerpo');
                if (tablaUsuarios && usuariosOriginales.length) {
                    const escapeHtml = (str) => {
                        if (!str) return '';
                        return String(str).replace(/[&<>]/g, m => m === '&' ? '&amp;' : (m === '<' ? '&lt;' : '&gt;'));
                    };
                    tablaUsuarios.innerHTML = usuariosOriginales.map(user => `
            <tr>
                <td data-label="Email">${escapeHtml(user.email || '')}</td>
                <td data-label="Nombre">${escapeHtml(user.nombre || '')}</td>
                <td data-label="Rol"><span class="rol-badge ${user.rol === 'admin' ? 'rol-admin' : 'rol-usuario'}">${user.rol || 'usuario'}</span></td>
                <td data-label="Estado">${user.activo === 'TRUE' ? '✅ Activo' : '❌ Inactivo'}</td>
                <td data-label="Acciones">
                    <button class="accion-btn" style="background:#dc3545;color:white;" onclick="eliminarUsuario('${user.id}')">🗑️ Eliminar</button>
                </td>
            </tr>
        `).join('');
                }
            } else {
                await cargarUsuariosAdmin();
            }
        }

        function inicializarBuscador() {
            const input = document.getElementById('buscadorAdmin');
            if (!input) return;

            // Eliminar eventos anteriores para evitar duplicados
            const nuevoInput = input.cloneNode(true);
            input.parentNode.replaceChild(nuevoInput, input);

            nuevoInput.addEventListener('input', aplicarBusqueda);
            nuevoInput.addEventListener('keyup', (e) => {
                if (e.key === 'Escape') limpiarBusqueda();
            });

            // Botón limpiar
            const limpiarBtn = document.getElementById('limpiarBusqueda');
            if (limpiarBtn) {
                const nuevoBtn = limpiarBtn.cloneNode(true);
                limpiarBtn.parentNode.replaceChild(nuevoBtn, limpiarBtn);
                nuevoBtn.addEventListener('click', limpiarBusqueda);
            }
        }

        // Modificar cargarAvisosParaAdmin para guardar originales
        const originalCargarAvisos = window.cargarAvisosParaAdmin;
        window.cargarAvisosParaAdmin = async function () {
            await originalCargarAvisos();
            if (todosLosAvisos.length && avisosOriginales.length === 0) {
                avisosOriginales = [...todosLosAvisos];
            }
            inicializarBuscador();
        };

        // Modificar cargarUsuariosAdmin para guardar originales
        const originalCargarUsuariosGlobal = window.cargarUsuariosAdmin;
        window.cargarUsuariosAdmin = async function () {
            await originalCargarUsuariosGlobal();
            setTimeout(guardarCopiasOriginales, 300);
        };

        // Controlar visibilidad del buscador al cambiar de pestaña
        function controlarVisibilidadBuscador() {
            const buscador = document.querySelector('.buscador-universal');
            if (!buscador) return;

            const tabActivo = document.querySelector('.tab.activo');
            const esVisible = tabActivo && (tabActivo.id === 'tab-lista' || tabActivo.id === 'tab-usuarios');

            buscador.style.display = esVisible ? 'block' : 'none';

            // Limpiar búsqueda al cambiar de pestaña
            if (!esVisible) {
                const input = document.getElementById('buscadorAdmin');
                if (input && input.value.trim()) {
                    input.value = '';
                    aplicarBusqueda();
                }
            }
        }

        // Escuchar cambios de pestaña
        const observer = new MutationObserver(() => {
            controlarVisibilidadBuscador();
        });

        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                agregarResultadosDiv();
                inicializarBuscador();
                controlarVisibilidadBuscador();

                // Observar cambios en clases de tabs
                const tabs = document.querySelectorAll('.tab');
                tabs.forEach(tab => {
                    observer.observe(tab, { attributes: true, attributeFilter: ['class'] });
                });

                // También observar clicks en botones de pestaña
                document.querySelectorAll('.filtro').forEach(btn => {
                    btn.addEventListener('click', () => {
                        setTimeout(() => {
                            controlarVisibilidadBuscador();
                            guardarCopiasOriginales();
                        }, 100);
                    });
                });
            }, 500);
        });

        // Agregar div de resultados
        function agregarResultadosDiv() {
            if (!document.getElementById('resultados-busqueda')) {
                const wrapper = document.querySelector('.buscador-universal');
                if (wrapper) {
                    const div = document.createElement('div');
                    div.id = 'resultados-busqueda';
                    div.className = 'resultados-busqueda';
                    wrapper.appendChild(div);
                }
            }
        }

// ========== MANEJAR MULTIMEDIA EN MODAL DE EDICIÓN ==========
        const editInputMultimedia = document.getElementById('edit-archivo-multimedia');
        const editBtnImagen = document.getElementById('edit-btn-imagen');
        const editBtnVideo = document.getElementById('edit-btn-video');
        const editVistaPrevia = document.getElementById('edit-vista-previa');
        const editCampoImagenUrl = document.getElementById('edit-imagen_url');
        const editCampoVideoUrl = document.getElementById('edit-video_url');
        let editTipoSeleccionado = '';

        if (editBtnImagen) {
            editBtnImagen.addEventListener('click', () => {
                editTipoSeleccionado = 'imagen';
                editInputMultimedia.accept = 'image/*';
                editInputMultimedia.click();
            });
        }

        if (editBtnVideo) {
            editBtnVideo.addEventListener('click', () => {
                editTipoSeleccionado = 'video';
                editInputMultimedia.accept = 'video/*';
                editInputMultimedia.click();
            });
        }

        editInputMultimedia.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Limpiar campos anteriores
            editCampoImagenUrl.value = '';
            editCampoVideoUrl.value = '';

            // Mostrar preview local
            editVistaPrevia.innerHTML = `<p>🔄 Subiendo archivo... por favor espera</p>`;
            const urlLocal = URL.createObjectURL(file);

            if (editTipoSeleccionado === 'imagen') {
                editVistaPrevia.innerHTML = `<img src="${urlLocal}" style="max-width:100%; max-height:180px; border-radius:12px;">`;
                try {
                    const urlFinal = await subirImagenImgBB(file);
                    editCampoImagenUrl.value = urlFinal;
                    editVistaPrevia.innerHTML += `<p style="color:green; font-size:12px;">✅ Imagen lista</p>`;
                    if (window.API && API.mostrarExito) API.mostrarExito('✅ Imagen subida correctamente');
                } catch (err) {
                    editVistaPrevia.innerHTML += `<p style="color:red; font-size:12px;">❌ Error: ${err.message}</p>`;
                    if (window.API && API.mostrarError) API.mostrarError(err.message);
                }
            }
            else if (editTipoSeleccionado === 'video') {
                editVistaPrevia.innerHTML = `<video src="${urlLocal}" controls style="max-width:100%; max-height:180px; border-radius:12px;"></video>`;
                editVistaPrevia.innerHTML += `<p style="color:#666; font-size:12px;">⏳ Subiendo a Cloudinary... puede tomar unos segundos</p>`;
                try {
                    const urlFinal = await subirVideoCloudinary(file);
                    editCampoVideoUrl.value = urlFinal;
                    editVistaPrevia.innerHTML = `
                <video src="${urlLocal}" controls style="max-width:100%; max-height:180px; border-radius:12px;"></video>
                <p style="color:green; font-size:12px;">✅ Video listo: <a href="${urlFinal}" target="_blank">ver en Cloudinary</a></p>
            `;
                    if (window.API && API.mostrarExito) API.mostrarExito('✅ Video subido correctamente');
                } catch (err) {
                    console.error("Error detallado:", err);
                    editVistaPrevia.innerHTML = `
                <video src="${urlLocal}" controls style="max-width:100%; max-height:180px; border-radius:12px;"></video>
                <p style="color:red; font-size:12px;">❌ Error: ${err.message}</p>
                <p style="color:#666; font-size:11px;">Consejo: El video debe ser menor a 25MB</p>
            `;
                    if (window.API && API.mostrarError) API.mostrarError('❌ Error: ' + err.message);
                }
            }

            // Limpiar el input para permitir otra subida
            setTimeout(() => { editInputMultimedia.value = ''; }, 1000);
        });

// Mostrar/ocultar buscador según pestaña activa
        (function controlarBuscadorPorPestana() {
            const buscador = document.querySelector('.buscador-universal');
            if (!buscador) return;

            function actualizarBuscador() {
                const tabActivo = document.querySelector('.tab.activo');
                const esAvisos = tabActivo && tabActivo.id === 'tab-lista';
                const esUsuarios = tabActivo && tabActivo.id === 'tab-usuarios';

                buscador.style.display = (esAvisos || esUsuarios) ? 'block' : 'none';
            }

            // Escuchar clicks en los botones de pestaña
            document.querySelectorAll('.filtro').forEach(btn => {
                btn.addEventListener('click', () => {
                    setTimeout(actualizarBuscador, 50); // Pequeño delay para que el DOM se actualice
                });
            });

            // Ejecutar al cargar
            actualizarBuscador();
        })();
// ===== FIN JAVASCRIPT MIGRADO DESDE admin.html =====
