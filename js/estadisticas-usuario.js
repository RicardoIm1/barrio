// ============================================================
// COMPATIBILIDAD ADMIN
// ============================================================
(function () {
    'use strict';
    // El listado global de usuarios es estrictamente admin-only.
    // Evitamos el ruido de una llamada accidental desde scripts legacy.
    const usuarioActual = () => {
        try { return JSON.parse(localStorage.getItem('usuario') || 'null'); } catch (_) { return null; }
    };
    const esAdmin = () => String(usuarioActual()?.rol || '').toLowerCase() === 'admin';

    // Si admin.js expone la función global, protegemos invocaciones posteriores.
    // La seguridad real sigue estando en Supabase/RLS.
    if (!esAdmin() && typeof window.cargarUsuariosAdmin === 'function' && !window.cargarUsuariosAdmin.__elBarrioNormalGuard) {
        const original = window.cargarUsuariosAdmin;
        const guard = function () {
            if (!esAdmin()) return Promise.resolve();
            return original.apply(this, arguments);
        };
        guard.__elBarrioNormalGuard = true;
        window.cargarUsuariosAdmin = guard;
    }

    // Normaliza el valor de fecha cuando admin.js abre el formulario de edición.
    function protegerFecha() {
        const campo = document.getElementById('edit-fecha_evento');
        if (!campo || campo.type !== 'date' || campo.dataset.elBarrioFechaGuard === '1') return;
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        if (!descriptor?.get || !descriptor?.set) return;
        Object.defineProperty(campo, 'value', {
            configurable: true,
            enumerable: descriptor.enumerable,
            get() { return descriptor.get.call(this); },
            set(valor) {
                const normalizado = typeof valor === 'string' && valor.includes('T') ? valor.split('T')[0] : valor;
                descriptor.set.call(this, normalizado);
            }
        });
        campo.dataset.elBarrioFechaGuard = '1';
    }
    protegerFecha();
    new MutationObserver(protegerFecha).observe(document.documentElement, { childList: true, subtree: true });
})();

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
        return Number.isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const formatoNumero = v => numero(v).toLocaleString('es-MX');
    function obtenerUsuario() {
        try { const raw = localStorage.getItem('usuario'); return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
    }
    function esUsuarioNormal(usuario) { return !!usuario && usuario.rol !== 'admin' && usuario.rol !== 'moderador'; }

    function instalarEstilos() {
        if (document.getElementById('estilos-estadisticas-usuario')) return;
        const style = document.createElement('style');
        style.id = 'estilos-estadisticas-usuario';
        style.textContent = `
            .estadisticas-usuario-footer { width:100%;margin:1rem 0 0;padding:1rem 0 0;border-top:1px solid rgba(255,255,255,.12); }
            .estadisticas-usuario-footer .eu-cabecera { display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;margin-bottom:1rem; }
            .estadisticas-usuario-footer h2 { margin:0 0 .25rem;font-size:1.2rem; }
            .estadisticas-usuario-footer .eu-sub { margin:0;opacity:.75;font-size:.8rem; }
            .estadisticas-usuario-footer .eu-grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.65rem;margin-bottom:1rem; }
            .estadisticas-usuario-footer .eu-card { padding:.8rem;border-radius:.7rem;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1); }
            .estadisticas-usuario-footer .eu-label { display:block;font-size:.68rem;opacity:.7;margin-bottom:.2rem;text-transform:uppercase;letter-spacing:.03em; }
            .estadisticas-usuario-footer .eu-value { display:block;font-size:1.25rem;font-weight:700; }
            .estadisticas-usuario-footer .eu-panel { margin-top:.75rem;padding:.8rem;border-radius:.7rem;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08); }
            .estadisticas-usuario-footer .eu-panel h3 { margin:0 0 .6rem;font-size:.9rem; }
            .estadisticas-usuario-footer .eu-chart-wrap { width:100%;overflow:hidden; }
            .estadisticas-usuario-footer canvas { display:block;width:100%;height:170px; }
            .estadisticas-usuario-footer .eu-tabla-wrap { overflow-x:auto; }
            .estadisticas-usuario-footer table { width:100%;border-collapse:collapse;font-size:.76rem; }
            .estadisticas-usuario-footer th { text-align:left;background:rgba(255,255,255,.08);padding:.55rem;white-space:nowrap; }
            .estadisticas-usuario-footer td { padding:.55rem;border-top:1px solid rgba(255,255,255,.08);vertical-align:middle; }
            .estadisticas-usuario-footer .eu-num { text-align:right;white-space:nowrap; }
            .estadisticas-usuario-footer .eu-estado { font-size:.68rem;font-weight:600;padding:.18rem .45rem;border-radius:999px;background:rgba(40,167,69,.18); }
            .estadisticas-usuario-footer .eu-estado.pendiente { background:rgba(245,176,66,.18); }
            .estadisticas-usuario-footer .eu-vacio { opacity:.7;padding:1rem 0;text-align:center; }
            @media (max-width:600px) { .estadisticas-usuario-footer { padding-top:.8rem; } .estadisticas-usuario-footer .eu-grid { grid-template-columns:repeat(2,1fr); } .estadisticas-usuario-footer .eu-value { font-size:1.1rem; } }
        `;
        document.head.appendChild(style);
    }

    function crearContenedor(usuario, footer) {
        let section = document.getElementById('estadisticas-usuario');
        if (section) return section;
        section = document.createElement('section');
        section.id = 'estadisticas-usuario';
        section.className = 'estadisticas-usuario-footer';
        section.innerHTML = `
            <div class="eu-cabecera"><div><h2>Mis estadísticas</h2><p class="eu-sub">Rendimiento de los avisos publicados por ${escapar(usuario.nombre || 'usuario')}</p></div></div>
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
        footer.appendChild(section);
        return section;
    }

    function dibujarGrafica(avisos) {
        const canvas = document.getElementById('eu-chart'); if (!canvas) return;
        const rect=canvas.getBoundingClientRect(),ratio=window.devicePixelRatio||1,w=Math.max(320,Math.floor(rect.width||700)),h=170;
        canvas.width=w*ratio;canvas.height=h*ratio;const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
        const dias=[],hoy=new Date();hoy.setHours(0,0,0,0);for(let i=29;i>=0;i--){const d=new Date(hoy);d.setDate(hoy.getDate()-i);dias.push(d);}
        const conteo=new Map();avisos.forEach(a=>{const k=fechaClave(a.created_at);if(k)conteo.set(k,(conteo.get(k)||0)+1);});
        const valores=dias.map(d=>conteo.get(fechaClave(d))||0),max=Math.max(1,...valores),pad={l:36,r:12,t:12,b:30},cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;
        ctx.font='10px system-ui';ctx.textAlign='right';ctx.textBaseline='middle';for(let i=0;i<=4;i++){const y=pad.t+ch-ch*i/4;ctx.strokeStyle='rgba(255,255,255,.12)';ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillStyle='rgba(255,255,255,.65)';ctx.fillText(String(Math.round(max*i/4)),pad.l-6,y);}
        const puntos=valores.map((v,i)=>({x:pad.l+cw*i/(dias.length-1),y:pad.t+ch-(v/max)*ch}));ctx.strokeStyle='#f5b042';ctx.lineWidth=3;ctx.beginPath();puntos.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.fillStyle='#f5b042';puntos.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill();});
        ctx.fillStyle='rgba(255,255,255,.65)';ctx.textAlign='center';ctx.textBaseline='top';dias.forEach((d,i)=>{if(i%5===0||i===dias.length-1){const x=pad.l+cw*i/(dias.length-1);ctx.fillText(d.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit'}),x,h-pad.b+7);}});
    }

    async function cargar() {
        const usuario=obtenerUsuario();if(!esUsuarioNormal(usuario)||!usuario.id)return;
        instalarEstilos();const footer=document.querySelector('.dashboard-footer');if(!footer)return;crearContenedor(usuario,footer);
        try {
            const client=await (typeof window.getSupabaseClient==='function'?window.getSupabaseClient():window.supabaseClient);if(!client)throw new Error('Cliente Supabase no disponible');
            const {data:avisos,error}=await client.from('avisos').select('id,titulo,status,created_at,vistas').eq('created_by',usuario.id).neq('status','eliminado').order('created_at',{ascending:false});if(error)throw error;
            const lista=avisos||[];let positivos=0,negativos=0;const votosPorAviso=new Map();
            if(lista.length){const ids=lista.map(a=>a.id);const {data:votos,error:errorVotos}=await client.from('votos').select('aviso_id,tipo').in('aviso_id',ids);if(!errorVotos){(votos||[]).forEach(v=>{const actual=votosPorAviso.get(v.aviso_id)||{positivos:0,negativos:0};if(v.tipo==='positivo'){actual.positivos++;positivos++;}if(v.tipo==='negativo'){actual.negativos++;negativos++;}votosPorAviso.set(v.aviso_id,actual);});}else console.warn('No se pudieron cargar los votos de los avisos propios:',errorVotos);}
            const vistas=lista.reduce((sum,a)=>sum+numero(a.vistas),0),activos=lista.filter(a=>a.status==='activo').length,interacciones=positivos+negativos;
            document.getElementById('eu-total-avisos').textContent=formatoNumero(lista.length);document.getElementById('eu-activos').textContent=formatoNumero(activos);document.getElementById('eu-vistas').textContent=formatoNumero(vistas);document.getElementById('eu-positivos').textContent=formatoNumero(positivos);document.getElementById('eu-negativos').textContent=formatoNumero(negativos);document.getElementById('eu-interacciones').textContent=formatoNumero(interacciones);
            dibujarGrafica(lista);const tbody=document.getElementById('eu-tabla-cuerpo');if(!lista.length){tbody.innerHTML='<tr><td colspan="6" class="eu-vacio">Todavía no tienes avisos publicados.</td></tr>';return;}
            tbody.innerHTML=lista.map(a=>{const v=votosPorAviso.get(a.id)||{positivos:0,negativos:0},vistasAviso=numero(a.vistas),inter=v.positivos+v.negativos,estado=a.status||'pendiente',textoEstado=estado==='activo'?'Activo':estado==='rechazado'?'Rechazado':'Pendiente';return `<tr><td><strong>${escapar(a.titulo||'Sin título')}</strong></td><td><span class="eu-estado ${estado}">${textoEstado}</span></td><td class="eu-num">${formatoNumero(vistasAviso)}</td><td class="eu-num">${formatoNumero(v.positivos)}</td><td class="eu-num">${formatoNumero(v.negativos)}</td><td class="eu-num">${formatoNumero(inter)}</td></tr>`;}).join('');
        } catch(error){console.error('❌ Estadísticas personales:',error);const tbody=document.getElementById('eu-tabla-cuerpo');if(tbody)tbody.innerHTML='<tr><td colspan="6" class="eu-vacio">No se pudieron cargar las estadísticas.</td></tr>';}
    }
    function iniciar(){if(!document.body)return;const usuario=obtenerUsuario();if(!esUsuarioNormal(usuario))return;setTimeout(cargar,500);}
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar,{once:true});else iniciar();
})();
