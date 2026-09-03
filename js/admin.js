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
// MÉTRICAS COMERCIALES + GRÁFICAS REALES + PRESENCIA
// ============================================================== 
(function inicializarMetricasComercialesAdmin(){
    let timer=null;
    const numero=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
    const formatear=v=>numero(v).toLocaleString('es-MX');
    const escapar=v=>{const d=document.createElement('div');d.textContent=v==null?'':String(v);return d.innerHTML;};
    const dias=30;
    const umbralOnlineMinutos=2;
    let ultimoDatos=null;
    let cargando=false;

    function actualizar(id,v){const e=document.getElementById(id);if(e)e.textContent=formatear(v);}
    function fechas30(){const r=[],hoy=new Date();hoy.setHours(0,0,0,0);for(let i=dias-1;i>=0;i--){const d=new Date(hoy);d.setDate(hoy.getDate()-i);r.push(d);}return r;}
    function clave(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
    function etiqueta(d){return d.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit'});}

    function prepararPanel(id,titulo,subtitulo){let p=document.getElementById(id);const footer=document.querySelector('.dashboard-footer .contenedor');if(!footer)return null;if(!p){p=document.createElement('div');p.id=id;p.className='dashboard-chart';p.innerHTML=`<div class="chart-header"><div><h4>${titulo}</h4><span style="color:#888;font-size:.72rem">${subtitulo}</span></div></div><div style="position:relative;width:100%;min-height:280px"><canvas id="${id}-canvas" style="display:block;width:100%;height:280px"></canvas></div><div id="${id}-stats" class="chart-stats-mini"></div>`;const resumen=document.getElementById('statsSummary');if(resumen)footer.insertBefore(p,resumen);else footer.appendChild(p);}return p;}

    function canvasSize(canvas){const rect=canvas.getBoundingClientRect(),ratio=window.devicePixelRatio||1,w=Math.max(320,Math.floor(rect.width||700)),h=280;canvas.width=w*ratio;canvas.height=h*ratio;const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);return{ctx,w,h};}
    function lineChart(canvas,labels,values){const {ctx,w,h}=canvasSize(canvas);ctx.clearRect(0,0,w,h);const pad={l:42,r:18,t:20,b:42},cw=w-pad.l-pad.r,ch=h-pad.t-pad.b,max=Math.max(1,...values),steps=4;ctx.font='11px system-ui';ctx.textAlign='right';ctx.textBaseline='middle';for(let i=0;i<=steps;i++){const y=pad.t+ch-(ch*i/steps),v=max*i/steps;ctx.strokeStyle='rgba(255,255,255,.10)';ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillStyle='#888';ctx.fillText(Math.round(v).toLocaleString('es-MX'),pad.l-7,y);}const pts=values.map((v,i)=>{const x=pad.l+(labels.length===1?cw/2:cw*i/(labels.length-1)),y=pad.t+ch-(v/max)*ch;return{x,y};});ctx.strokeStyle='#f5b042';ctx.lineWidth=3;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();pts.forEach(p=>{ctx.fillStyle='#f5b042';ctx.beginPath();ctx.arc(p.x,p.y,3.5,0,Math.PI*2);ctx.fill();});ctx.fillStyle='#888';ctx.textAlign='center';ctx.textBaseline='top';labels.forEach((l,i)=>{if(i%5===0||i===labels.length-1){const x=pad.l+(labels.length===1?cw/2:cw*i/(labels.length-1));ctx.fillText(l,x,h-pad.b+10);}});}
    function barChart(canvas,labels,values){const {ctx,w,h}=canvasSize(canvas);ctx.clearRect(0,0,w,h);const pad={l:42,r:18,t:20,b:58},cw=w-pad.l-pad.r,ch=h-pad.t-pad.b,max=Math.max(1,...values),n=values.length,gap=Math.min(18,cw/Math.max(n,1)*.15),bw=Math.max(10,(cw-gap*(n+1))/Math.max(n,1));ctx.font='11px system-ui';ctx.textAlign='center';ctx.textBaseline='top';values.forEach((v,i)=>{const x=pad.l+gap+i*(bw+gap),bh=(v/max)*ch,y=pad.t+ch-bh;ctx.fillStyle='rgba(245,176,66,.85)';ctx.fillRect(x,y,bw,bh);ctx.fillStyle='#ccc';ctx.fillText(String(v).toLocaleString('es-MX'),x+bw/2,Math.max(4,y-16));let lab=String(labels[i]||'');if(lab.length>16)lab=lab.slice(0,16)+'…';ctx.fillStyle='#888';ctx.save();ctx.translate(x+bw/2,h-pad.b+8);ctx.rotate(-Math.PI/6);ctx.fillText(lab,0,0);ctx.restore();});for(let i=0;i<=4;i++){const y=pad.t+ch-(ch*i/4);ctx.strokeStyle='rgba(255,255,255,.08)';ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();}}

    function graficarDiarios(usuarios,avisos){const fechas=fechas30(),labels=fechas.map(etiqueta),u=fechas.map(d=>0),a=fechas.map(d=>0),mapU=new Map(),mapA=new Map();usuarios.forEach(x=>{if(x.fecha_registro){const k=clave(new Date(x.fecha_registro));mapU.set(k,(mapU.get(k)||0)+1);}});avisos.forEach(x=>{if(x.created_at){const k=clave(new Date(x.created_at));mapA.set(k,(mapA.get(k)||0)+1);}});fechas.forEach((d,i)=>{u[i]=mapU.get(clave(d))||0;a[i]=mapA.get(clave(d))||0;});let p=prepararPanel('admin-chart-usuarios','Usuarios registrados','Últimos 30 días');lineChart(p.querySelector('canvas'),labels,u);p.querySelector('.chart-stats-mini').textContent=`Total en periodo: ${formatear(u.reduce((s,v)=>s+v,0))}`;p=prepararPanel('admin-chart-avisos','Avisos creados','Últimos 30 días');lineChart(p.querySelector('canvas'),labels,a);p.querySelector('.chart-stats-mini').textContent=`Total en periodo: ${formatear(a.reduce((s,v)=>s+v,0))}`;}

    function graficarCategorias(avisos){const m=new Map();avisos.forEach(a=>{const c=String(a.categoria||'varios').trim()||'varios';m.set(c,(m.get(c)||0)+1);});const arr=[...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);const p=prepararPanel('admin-chart-categorias','Avisos por categoría','Distribución actual');barChart(p.querySelector('canvas'),arr.map(x=>x[0]),arr.map(x=>x[1]));p.querySelector('.chart-stats-mini').textContent=`Categorías con avisos: ${m.size}`;actualizar('totalCategorias',m.size);}
    function graficarEstados(avisos){const activos=avisos.filter(a=>a.status==='activo').length,pendientes=avisos.filter(a=>a.status==='pendiente').length;const p=prepararPanel('admin-chart-estados','Estado de los avisos','Situación actual');barChart(p.querySelector('canvas'),['Activos','Pendientes'],[activos,pendientes]);p.querySelector('.chart-stats-mini').textContent=`Activos: ${formatear(activos)} · Pendientes: ${formatear(pendientes)}`;actualizar('avisosActivos',activos);actualizar('avisosPendientes',pendientes);const card=document.getElementById('pendingCard');if(card)card.style.display=pendientes>0?'flex':'none';}
    function graficarVotos(pos,neg){const p=prepararPanel('admin-chart-votos','Votos registrados','Fuente: tabla votos');barChart(p.querySelector('canvas'),['Positivos','Negativos'],[pos,neg]);p.querySelector('.chart-stats-mini').textContent=`Total: ${formatear(pos+neg)} votos`;} 
    function graficarAlcance(avisos){const arr=avisos.filter(a=>numero(a.vistas)>0).sort((a,b)=>numero(b.vistas)-numero(a.vistas)).slice(0,5);const p=prepararPanel('admin-chart-alcance','Mayor alcance de avisos','Top 5 por vistas acumuladas');barChart(p.querySelector('canvas'),arr.map(a=>a.titulo||'Sin título'),arr.map(a=>numero(a.vistas)));p.querySelector('.chart-stats-mini').textContent=arr.length?'Las vistas son acumuladas por aviso.':'Aún no hay vistas registradas.';}

    function renderOnlineUsers(usuariosOnline){
        const panel=document.getElementById('chartOnline');
        const lista=document.getElementById('onlineUsersList');
        const badge=document.getElementById('onlineCount');
        if(!panel||!lista||!badge)return;
        panel.style.display='block';
        badge.textContent=`${usuariosOnline.length} ${usuariosOnline.length===1?'conectado':'conectados'}`;
        if(!usuariosOnline.length){lista.innerHTML='<p style="color:#888;margin:0;padding:12px 0;">No hay usuarios activos en este momento.</p>';return;}
        lista.innerHTML=usuariosOnline.map(u=>{
            const nombre=escapar(u.nombre||'Usuario');
            const email=escapar(u.email||'');
            const fecha=u.ultima_actividad?new Date(u.ultima_actividad):null;
            const segundos=fecha&&!Number.isNaN(fecha.getTime())?Math.max(0,Math.floor((Date.now()-fecha.getTime())/1000)):0;
            const tiempo=segundos<10?'ahora':segundos<60?`hace ${segundos} s`: `hace ${Math.floor(segundos/60)} min`;
            return `<div class="online-user-item"><div><strong style="color:#eee;">${nombre}</strong>${email?`<div class="online-user-email">${email}</div>`:''}</div><span class="online-user-time">● ${tiempo}</span></div>`;
        }).join('');
    }

    async function cargar(){
        if(cargando)return;
        cargando=true;
        const footer=document.querySelector('.dashboard-footer');
        if(!footer||typeof getSupabaseClient!=='function')return;
        try{
            const client=await getSupabaseClient();
            const [ur,ar,vr,or]=await Promise.all([
                client.from('usuarios').select('id,fecha_registro,ultimo_acceso').range(0,9999),
                client.from('avisos').select('id,titulo,categoria,created_at,status,vistas').range(0,9999),
                client.rpc('obtener_resumen_votos_admin'),
                client.rpc('obtener_usuarios_en_linea_admin')
            ]);
            if(ur.error)throw ur.error;
            if(ar.error)throw ar.error;
            if(vr.error)throw vr.error;
            if(or.error)throw or.error;

            const usuarios=ur.data||[],avisos=(ar.data||[]).filter(a=>a.status!=='eliminado');
            const votosRaw=typeof vr.data==='string'?JSON.parse(vr.data):(vr.data||{});
            const onlineRaw=typeof or.data==='string'?JSON.parse(or.data):(or.data||{});
            const pos=numero(votosRaw.positivos),neg=numero(votosRaw.negativos),votos=numero(votosRaw.total??(pos+neg));
            const usuariosOnline=Array.isArray(onlineRaw)?onlineRaw:(Array.isArray(onlineRaw.usuarios)?onlineRaw.usuarios:[]);

            const totalUsuarios=usuarios.length,totalAvisos=avisos.length,activos=avisos.filter(a=>a.status==='activo').length,pendientes=avisos.filter(a=>a.status==='pendiente').length,totalVistas=avisos.reduce((s,a)=>s+numero(a.vistas),0),promVistas=totalAvisos?totalVistas/totalAvisos:0,promVotos=totalAvisos?votos/totalAvisos:0,tasa=totalVistas?votos/totalVistas*100:0;
            actualizar('totalAvisos',totalAvisos);actualizar('avisosActivos',activos);actualizar('avisosPendientes',pendientes);actualizar('totalVisitas',totalVistas);actualizar('totalInteracciones',votos);actualizar('totalUsuarios',totalUsuarios);actualizar('totalCategorias',new Set(avisos.map(a=>String(a.categoria||'varios').trim()||'varios')).size);
            const card=document.getElementById('pendingCard');if(card)card.style.display=pendientes>0?'flex':'none';
            const cards=document.querySelectorAll('.dashboard-footer .stat-card');cards.forEach(card=>{const t=card.querySelector('h4'),l=card.querySelector('.stat-label');if(!t)return;const txt=t.textContent.trim().toLowerCase();if(txt==='interacciones'||txt==='votos registrados'){t.textContent='Votos registrados';if(l)l.textContent='positivos + negativos';}if(txt==='total visitas'||txt==='alcance'){t.textContent='Alcance';if(l)l.textContent='vistas acumuladas';}});
            let resumen=document.getElementById('statsSummary');if(resumen){resumen.style.display='flex';let extra=document.getElementById('admin-commercial-summary');if(!extra){extra=document.createElement('div');extra.id='admin-commercial-summary';extra.style.cssText='display:flex;justify-content:center;gap:24px;flex-wrap:wrap;margin-top:12px;padding:12px 20px;background:rgba(255,255,255,.03);border-radius:16px;font-size:.72rem;color:#888;';resumen.insertAdjacentElement('afterend',extra);}extra.innerHTML=`<span>Alcance promedio: <strong style="color:#f5b042">${promVistas.toFixed(1)}</strong></span><span>Votos promedio: <strong style="color:#f5b042">${promVotos.toFixed(1)}</strong></span><span>Participación vistas/votos: <strong style="color:#f5b042">${tasa.toFixed(2)}%</strong></span><span>👍 ${formatear(pos)} · 👎 ${formatear(neg)}</span>`;}
            graficarDiarios(usuarios,avisos);graficarCategorias(avisos);graficarEstados(avisos);graficarVotos(pos,neg);graficarAlcance(avisos);renderOnlineUsers(usuariosOnline);
            ultimoDatos={usuarios,avisos,pos,neg};
            console.log('📊 Dashboard admin actualizado:',{totalUsuarios,totalAvisos,activos,pendientes,totalVistas,pos,neg,votos,usuariosOnline:usuariosOnline.length});
        }catch(error){
            console.error('❌ No se pudieron cargar las métricas del panel admin:',error);
            const badge=document.getElementById('onlineCount');if(badge)badge.textContent='No disponible';
        }finally{
            cargando=false;
        }
    }

    function observar(){
        const contenedor=document.getElementById('footer-container');
        if(!contenedor)return;
        const iniciar=()=>{
            if(!document.querySelector('.dashboard-footer'))return;
            if(!timer)timer=setInterval(cargar,15000);
            cargar();
        };
        const obs=new MutationObserver(()=>{
            if(document.querySelector('.dashboard-footer')){
                obs.disconnect();
                iniciar();
            }
        });
        obs.observe(contenedor,{childList:true,subtree:true});
        iniciar();
        window.addEventListener('resize',()=>{if(ultimoDatos){graficarDiarios(ultimoDatos.usuarios,ultimoDatos.avisos);graficarCategorias(ultimoDatos.avisos);graficarEstados(ultimoDatos.avisos);graficarVotos(ultimoDatos.pos,ultimoDatos.neg);graficarAlcance(ultimoDatos.avisos);}});
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observar,{once:true});else observar();
})();
