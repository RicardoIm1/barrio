// ==============================================================
// GRÁFICAS ADMIN: DATOS REALES DE SUPABASE
// ==============================================================
(function inicializarGraficasAdminReales() {
    const DIAS = 30;
    let timer = null;
    let observador = null;

    function obtenerCliente() {
        if (typeof getSupabaseClient === 'function') return getSupabaseClient();
        if (window.supabaseClient) return Promise.resolve(window.supabaseClient);
        if (typeof obtenerSupabaseClient === 'function') return obtenerSupabaseClient();
        return Promise.reject(new Error('Cliente Supabase no disponible'));
    }

    function claveFecha(fecha) {
        const d = new Date(fecha);
        if (Number.isNaN(d.getTime())) return null;
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function prepararFechas() {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const fechas = [];
        for (let i = DIAS - 1; i >= 0; i--) {
            const d = new Date(hoy);
            d.setDate(hoy.getDate() - i);
            fechas.push(d);
        }
        return fechas;
    }

    function etiqueta(fecha) {
        return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' });
    }

    function prepararCanvas(canvas) {
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        const w = Math.max(320, Math.floor(rect.width || canvas.parentElement?.clientWidth || 700));
        const h = 250;
        canvas.width = w * ratio;
        canvas.height = h * ratio;
        canvas.style.width = '100%';
        canvas.style.height = `${h}px`;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        return { ctx, w, h };
    }

    function dibujarLinea(canvas, labels, values) {
        const preparado = prepararCanvas(canvas);
        if (!preparado) return;
        const { ctx, w, h } = preparado;
        ctx.clearRect(0, 0, w, h);
        const pad = { l: 42, r: 18, t: 20, b: 42 };
        const cw = w - pad.l - pad.r;
        const ch = h - pad.t - pad.b;
        const max = Math.max(1, ...values);
        const pasos = 4;
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let i = 0; i <= pasos; i++) {
            const y = pad.t + ch - (ch * i / pasos);
            const valor = Math.round(max * i / pasos);
            ctx.strokeStyle = 'rgba(255,255,255,.10)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pad.l, y);
            ctx.lineTo(w - pad.r, y);
            ctx.stroke();
            ctx.fillStyle = '#888';
            ctx.fillText(valor.toLocaleString('es-MX'), pad.l - 7, y);
        }
        const puntos = values.map((valor, i) => ({
            x: pad.l + (values.length === 1 ? cw / 2 : cw * i / (values.length - 1)),
            y: pad.t + ch - (valor / max) * ch
        }));
        ctx.strokeStyle = '#f5b042';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        puntos.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        ctx.stroke();
        puntos.forEach(p => {
            ctx.fillStyle = '#f5b042';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.fillStyle = '#888';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        labels.forEach((label, i) => {
            if (i % 5 === 0 || i === labels.length - 1) {
                const x = pad.l + (labels.length === 1 ? cw / 2 : cw * i / (labels.length - 1));
                ctx.fillText(label, x, h - pad.b + 10);
            }
        });
    }

    function obtenerVentanaInicio() {
        const inicio = new Date();
        inicio.setHours(0, 0, 0, 0);
        inicio.setDate(inicio.getDate() - (DIAS - 1));
        return inicio.toISOString();
    }

    function mostrarPanel(id) {
        const panel = document.getElementById(id);
        if (panel) panel.style.display = 'block';
        return panel;
    }

    function actualizarResumen(id, texto) {
        const el = document.getElementById(id);
        if (el) el.textContent = texto;
    }

    async function cargarGraficas() {
        const canvasUsuarios = document.getElementById('chartUsuariosCanvas');
        const canvasAvisos = document.getElementById('chartAvisosCanvas');
        if (!canvasUsuarios && !canvasAvisos) return false;
        try {
            const client = await obtenerCliente();
            const desde = obtenerVentanaInicio();
            const [usuariosResp, avisosResp] = await Promise.all([
                client.from('usuarios')
                    .select('id,fecha_registro')
                    .gte('fecha_registro', desde)
                    .order('fecha_registro', { ascending: true }),
                client.from('avisos')
                    .select('id,created_at,status')
                    .gte('created_at', desde)
                    .neq('status', 'eliminado')
                    .order('created_at', { ascending: true })
            ]);
            if (usuariosResp.error) throw usuariosResp.error;
            if (avisosResp.error) throw avisosResp.error;
            const fechas = prepararFechas();
            const labels = fechas.map(etiqueta);
            const mapaUsuarios = new Map();
            const mapaAvisos = new Map();
            (usuariosResp.data || []).forEach(usuario => {
                const clave = claveFecha(usuario.fecha_registro);
                if (clave) mapaUsuarios.set(clave, (mapaUsuarios.get(clave) || 0) + 1);
            });
            (avisosResp.data || []).forEach(aviso => {
                const clave = claveFecha(aviso.created_at);
                if (clave) mapaAvisos.set(clave, (mapaAvisos.get(clave) || 0) + 1);
            });
            const usuarios = fechas.map(d => mapaUsuarios.get(claveFecha(d)) || 0);
            const avisos = fechas.map(d => mapaAvisos.get(claveFecha(d)) || 0);
            const panelUsuarios = mostrarPanel('chartUsuariosDiarios');
            const panelAvisos = mostrarPanel('chartAvisosDiarios');
            dibujarLinea(canvasUsuarios, labels, usuarios);
            dibujarLinea(canvasAvisos, labels, avisos);
            actualizarResumen('usuariosStats', `Últimos ${DIAS} días: ${usuarios.reduce((s, v) => s + v, 0).toLocaleString('es-MX')} registros · Máximo diario: ${Math.max(...usuarios).toLocaleString('es-MX')}`);
            actualizarResumen('avisosStats', `Últimos ${DIAS} días: ${avisos.reduce((s, v) => s + v, 0).toLocaleString('es-MX')} avisos · Máximo diario: ${Math.max(...avisos).toLocaleString('es-MX')}`);
            if (panelUsuarios) panelUsuarios.dataset.graficado = '1';
            if (panelAvisos) panelAvisos.dataset.graficado = '1';
            console.log('📈 Gráficas diarias reales actualizadas:', {
                usuarios: usuarios.reduce((s, v) => s + v, 0),
                avisos: avisos.reduce((s, v) => s + v, 0)
            });
            return true;
        } catch (error) {
            console.error('❌ Error cargando gráficas diarias reales:', error);
            return false;
        }
    }

    function iniciar() {
        if (!document.getElementById('chartUsuariosCanvas') && !document.getElementById('chartAvisosCanvas')) return;
        cargarGraficas();
        if (!timer) timer = setInterval(cargarGraficas, 15000);
    }

    function observarFooter() {
        const footer = document.getElementById('footer-container');
        if (!footer) return;
        iniciar();
        observador = new MutationObserver(iniciar);
        observador.observe(footer, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', observarFooter, { once: true });
    } else {
        observarFooter();
    }

    window.addEventListener('resize', () => {
        if (document.getElementById('chartUsuariosDiarios')?.dataset.graficado === '1') cargarGraficas();
    });
})();
