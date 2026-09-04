// ============================================================
// ESTADÍSTICAS PERSONALES DEL USUARIO
// ============================================================
// Este módulo se activa únicamente para usuarios normales.
// Los administradores conservan su tablero global.
(function () {
    if (window.__ELBARRIO_ESTADISTICAS_USUARIO__) return;
    if (!/\/admin\.html$/i.test(window.location.pathname)) return;
    window.__ELBARRIO_ESTADISTICAS_USUARIO__ = true;

    const numero = v => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    };

    const escapar = v => {
        const d = document.createElement('div');
        d.textContent = v == null ? '' : String(v);
        return d.innerHTML;
    };

    const fechaClave = valor => {
        const d = new Date(valor);
        return Number.isNaN(d.getTime()) ? null :
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const formatoNumero = v => numero(v).toLocaleString('es-MX');

    function obtenerUsuario() {
        try {
            const raw = localStorage.getItem('usuario');
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    }

    function esUsuarioNormal(usuario) {
        return !!usuario && usuario.rol !== 'admin' && usuario.rol !== 'moderador';
    }

    function instalarEstilos() {
        if (document.getElementById('estilos-estadisticas-usuario')) return;
        const style = document.createElement('style');
        style.id = 'estilos-estadisticas-usuario';
        style.textContent = `
            #estadisticas-usuario { margin:0 0 2rem; padding:1.5rem; border:1px solid var(--color-borde,#e5e7eb); border-radius:1rem; background:rgba(255,255,255,.96); box-shadow:0 8px 24px rgba(0,0,0,.06); }
            #estadisticas-usuario .eu-cabecera { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap; margin-bottom:1.25rem; }
            #estadisticas-usuario h2 { margin:0 0 .25rem; font-size:1.35rem; color:#1e4620; }
            #estadisticas-usuario .eu-sub { margin:0; color:#6b7280; font-size:.86rem; }
            #estadisticas-usuario .eu-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:.8rem; margin-bottom:1.25rem; }
            #estadisticas-usuario .eu-card { padding:1rem; border-radius:.8rem; background:#f8fafc; border:1px solid #e5e7eb; }
            #estadisticas-usuario .eu-label { display:block; font-size:.72rem; color:#6b7280; margin-bottom:.3rem; text-transform:uppercase; letter-spacing:.03em; }
            #estadisticas-usuario .eu-value { display:block; font-size:1.55rem; font-weight:700; color:#1e4620; }
            #estadisticas-usuario .eu-panel { margin-top:1rem; padding:1rem; border:1px solid #e5e7eb; border-radius:.8rem; background:#fff; }
            #estadisticas-usuario .eu-panel h3 { margin:0 0 .75rem; font-size:1rem; color:#374151; }
            #estadisticas-usuario .eu-chart-wrap { width:100%; overflow:hidden; }
            #estadisticas-usuario canvas { display:block; width:100%; height:190px; }
            #estadisticas-usuario .eu-tabla-wrap { overflow-x:auto; }
            #estadisticas-usuario table { width:100%; border-collapse:collapse; font-size:.82rem; }
            #estadisticas-usuario th { text-align:left; background:#f3f4f6; color:#374151; padding:.65rem; white-space:nowrap; }
            #estadisticas-usuario td { padding:.65rem; border-top:1px solid #eef0f2; vertical-align:middle; }
            #estadisticas-usuario .eu-num { text-align:right; white-space:nowrap; }
            #estadisticas-usuario .eu-estado { font-size:.72rem; font-weight:600; padding:.2rem .5rem; border-radius:999px; background:#e8f5e9; color:#247a35; }
            #estadisticas-usuario .eu-estado.pendiente { background:#fff7e6; color:#9a6700; }
            #estadisticas-usuario .eu-vacio { color:#6b7280; padding:1rem 0; text-align:center; }
            @media (max-width:600px) { #estadisticas-usuario { padding:1rem; } #estadisticas-usuario .eu-value { font-size:1.3rem; } }
        `;
        document.head.appendChild(style);
    }

    function crearContenedor(usuario) {
        if (document.getElementById('estadisticas-usuario')) return document.getElementById('estadisticas-usuario');
        const section = document.createElement('section');
        section.id = 'estadisticas-usuario';
        section.innerHTML = `
            <div class="eu-cabecera"><div><h2>Mis estadísticas</h2><p class="eu-sub">Rendimiento de los avisos publicados por ${escapar(usuario.nombre || 'ti')}</p></div></div>
            <div class="eu-grid">
                <div class="eu-card"><span class="eu-label">Mis avisos</span><strong class="eu-value" id="eu-total-avisos">0</strong></div>
                <div class="eu-card"><span class="eu-label">Avisos activos</span><strong class="eu-value" id="eu-activos">0</strong></div>
                <div class="eu-card"><span class="eu-label">Vistas totales</span><strong class="eu-value" id="eu-vistas">0</strong></div>
                <div class="eu-card"><span class="eu-label">Votos positivos</span><strong class="eu-value" id="eu-positivos">0</strong></div>
                <div class="eu-card"><span class="eu-label">Votos negativos</span><strong class="eu-value" id="eu-negativos">0</strong></div>
                <div class="eu-card"><span class="eu-label">Interacciones</span><strong class="eu-value" id="eu-interacciones">0</strong></div>
            </div>
            <div class="eu-panel"><h3>Publicaciones de los últimos 30 días</h3><div class="eu-chart-wrap"><canvas id="eu-chart"></canvas></div></div>
            <div class="eu-panel"><h3>Rendimiento por aviso</h3><div class="eu-tabla-wrap"><table><thead><tr><th>Aviso</th><th>Estado</th><th class="eu-num">Vistas</th><th class="eu-num">👍</th><th class="eu-num">👎</th><th class="eu-num">Interacciones</th></tr></thead><tbody id="eu-tabla-cuerpo"><tr><td colspan="6" class="eu-vacio">Cargando estadísticas...</td></tr></tbody></table></div></div>`;
        const destino = document.querySelector('main') || document.querySelector('.container') || document.body;
        destino.prepend(section);
        return section;
    }

    function dibujarGrafica(avisos) {
        const canvas = document.getElementById('eu-chart');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect(), ratio = window.devicePixelRatio || 1, w = Math.max(320, Math.floor(rect.width || 700)), h = 190;
        canvas.width = w * ratio; canvas.height = h * ratio;
        const ctx = canvas.getContext('2d'); ctx.setTransform(ratio,0,0,ratio,0,0); ctx.clearRect(0,0,w,h);
        const dias = [], hoy = new Date(); hoy.setHours(0,0,0,0);
        for (let i=29;i>=0;i--) { const d=new Date(hoy); d.setDate(hoy.getDate()-i); dias.push(d); }
        const conteo=new Map(); avisos.forEach(a=>{const k=fechaClave(a.created_at);if(k)conteo.set(k,(conteo.get(k)||0)+1);});
        const valores=dias.map(d=>conteo.get(fechaClave(d))||0), max=Math.max(1,...valores), pad={l:36,r:12,t:16,b:34}, cw=w-pad.l-pad.r, ch=h-pad.t-pad.b;
        ctx.font='11px system-ui';ctx.textAlign='right';ctx.textBaseline='middle';
        for(let i=0;i<=4;i++){const y=pad.t+ch-ch*i/4;ctx.strokeStyle='#e5e7eb';ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillStyle='#6b7280';ctx.fillText(String(Math.round(max*i/4)),pad.l-6,y);}
        const puntos=valores.map((v,i)=>({x:pad.l+cw*i/(dias.length-1),y:pad.t+ch-(v/max)*ch}));
        ctx.strokeStyle='#f5b042';ctx.lineWidth=3;ctx.beginPath();puntos.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.fillStyle='#f5b042';puntos.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill();});
        ctx.fillStyle='#6b7280';ctx.textAlign='center';ctx.textBaseline='top';dias.forEach((d,i)=>{if(i%5===0||i===dias.length-1){const x=pad.l+cw*i/(dias.length-1);ctx.fillText(d.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit'}),x,h-pad.b+8);}});
    }

    async function cargar() {
        const usuario=obtenerUsuario(); if(!esUsuarioNormal(usuario)||!usuario.id)return;
        instalarEstilos(); crearContenedor(usuario);
        try {
            const client=await (typeof window.getSupabaseClient==='function'?window.getSupabaseClient():window.supabaseClient);
            if(!client)throw new Error('Cliente Supabase no disponible');
            const {data:avisos,error}=await client.from('avisos').select('id,titulo,status,created_at,vistas,visitas').eq('created_by',usuario.id).neq('status','eliminado').order('created_at',{ascending:false});
            if(error)throw error;
            const lista=avisos||[];let positivos=0,negativos=0;const votosPorAviso=new Map();
            if(lista.length){const ids=lista.map(a=>a.id);const {data:votos,error:errorVotos}=await client.from('votos').select('aviso_id,tipo').in('aviso_id',ids);if(!errorVotos){(votos||[]).forEach(v=>{const actual=votosPorAviso.get(v.aviso_id)||{positivos:0,negativos:0};if(v.tipo==='positivo'){actual.positivos++;positivos++;}if(v.tipo==='negativo'){actual.negativos++;negativos++;}votosPorAviso.set(v.aviso_id,actual);});}else console.warn('No se pudieron cargar los votos de los avisos propios:',errorVotos);}
            const vistas=lista.reduce((sum,a)=>sum+numero(a.vistas??a.visitas),0),activos=lista.filter(a=>a.status==='activo').length,interacciones=positivos+negativos;
            document.getElementById('eu-total-avisos').textContent=formatoNumero(lista.length);document.getElementById('eu-activos').textContent=formatoNumero(activos);document.getElementById('eu-vistas').textContent=formatoNumero(vistas);document.getElementById('eu-positivos').textContent=formatoNumero(positivos);document.getElementById('eu-negativos').textContent=formatoNumero(negativos);document.getElementById('eu-interacciones').textContent=formatoNumero(interacciones);
            dibujarGrafica(lista);
            const tbody=document.getElementById('eu-tabla-cuerpo');
            if(!lista.length){tbody.innerHTML='<tr><td colspan="6" class="eu-vacio">Todavía no tienes avisos publicados.</td></tr>';return;}
            tbody.innerHTML=lista.map(a=>{const v=votosPorAviso.get(a.id)||{positivos:0,negativos:0},vistasAviso=numero(a.vistas??a.visitas),inter=v.positivos+v.negativos,estado=a.status||'pendiente',textoEstado=estado==='activo'?'Activo':estado==='rechazado'?'Rechazado':'Pendiente';return `<tr><td><strong>${escapar(a.titulo||'Sin título')}</strong></td><td><span class="eu-estado ${estado}">${textoEstado}</span></td><td class="eu-num">${formatoNumero(vistasAviso)}</td><td class="eu-num">${formatoNumero(v.positivos)}</td><td class="eu-num">${formatoNumero(v.negativos)}</td><td class="eu-num">${formatoNumero(inter)}</td></tr>`;}).join('');
        } catch(error){console.error('❌ Estadísticas personales:',error);const tbody=document.getElementById('eu-tabla-cuerpo');if(tbody)tbody.innerHTML='<tr><td colspan="6" class="eu-vacio">No se pudieron cargar las estadísticas.</td></tr>';}
    }

    function iniciar(){if(!document.body)return;const usuario=obtenerUsuario();if(!esUsuarioNormal(usuario))return;setTimeout(cargar,350);}
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar,{once:true});else iniciar();
})();
