// ==============================================================
// ADMIN.JS
//
// El panel admin actual contiene su controlador principal dentro
// de admin.html. Durante la migración a Supabase evitamos cargar
// un segundo controlador que duplique eventos y peticiones.
//
// Este archivo se encarga de la navegación de pestañas, de cargar
// el perfil del usuario autenticado desde Supabase y de conectar
// los formularios con la API Supabase actual.
// ==============================================================

console.log('ℹ️ admin.js: controlador embebido de admin.html activo.');

(function inicializarPerfilAdmin() {
    function escapar(valor) {
        const div = document.createElement('div');
        div.textContent = valor == null ? '' : String(valor);
        return div.innerHTML;
    }

    function formatearFecha(valor) {
        if (!valor) return 'No disponible';
        const fecha = new Date(valor);
        if (Number.isNaN(fecha.getTime())) return String(valor);
        return fecha.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
    }

    function mostrarPerfil(perfil) {
        const contenedor = document.getElementById('perfil-info');
        if (!contenedor) return;
        const p = perfil || {};
        const nombre = p.nombre || p.name || 'Usuario';
        const email = p.email || 'No disponible';
        const rol = p.rol || 'usuario';
        const telefono = p.telefono || 'No registrado';
        const categorias = Array.isArray(p.categorias) ? p.categorias.join(', ') : (p.categorias || 'No registradas');
        contenedor.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;">
                <div class="campo"><label>Nombre</label><div>${escapar(nombre)}</div></div>
                <div class="campo"><label>Correo electrónico</label><div>${escapar(email)}</div></div>
                <div class="campo"><label>Rol</label><div>${escapar(rol)}</div></div>
                <div class="campo"><label>Teléfono</label><div>${escapar(telefono)}</div></div>
                <div class="campo"><label>Categorías</label><div>${escapar(categorias)}</div></div>
                <div class="campo"><label>Estado</label><div>${p.activo === false ? 'Inactivo' : 'Activo'}</div></div>
                <div class="campo"><label>Fecha de registro</label><div>${escapar(formatearFecha(p.fecha_registro))}</div></div>
                <div class="campo"><label>Último acceso</label><div>${escapar(formatearFecha(p.ultimo_acceso))}</div></div>
                <div class="campo"><label>Puntos de confianza</label><div>${escapar(p.puntos_confianza ?? 0)}</div></div>
                <div class="campo"><label>Nivel</label><div>${escapar(p.nivel || 'Sin nivel')}</div></div>
                <div class="campo"><label>Avisos publicados</label><div>${escapar(p.avisos_publicados ?? 0)}</div></div>
                <div class="campo"><label>Reportes recibidos</label><div>${escapar(p.reportes_recibidos ?? 0)}</div></div>
            </div>`;
    }

    async function cargarPerfil() {
        const contenedor = document.getElementById('perfil-info');
        if (!contenedor) return;
        try {
            const local = JSON.parse(localStorage.getItem('usuario') || 'null');
            if (local) mostrarPerfil(local);
        } catch (error) {
            console.warn('⚠️ No se pudo leer el perfil local:', error);
        }
        if (!window.supabaseClient) return;
        try {
            const { data: authData, error: authError } = await window.supabaseClient.auth.getUser();
            if (authError || !authData?.user?.id) return;
            const { data, error } = await window.supabaseClient.from('usuarios').select(`
                id, email, nombre, rol, categorias, activo, telefono,
                fecha_registro, ultimo_acceso, puntos_confianza, nivel,
                avisos_publicados, reportes_recibidos, reportes_realizados,
                votos_positivos_recibidos, votos_negativos_recibidos,
                fecha_verificacion, sancion_hasta`).eq('id', authData.user.id).maybeSingle();
            if (error) {
                console.error('❌ Error cargando perfil desde Supabase:', error);
                return;
            }
            if (data) mostrarPerfil(data);
        } catch (error) {
            console.error('❌ Error inesperado cargando perfil:', error);
        }
    }
    window.cargarPerfilAdmin = cargarPerfil;
})();

(function inicializarPestanasAdmin() {
    function activarPestana(tabName) {
        const botones = document.querySelectorAll('#admin-tabs .filtro[data-tab]');
        const paneles = document.querySelectorAll('.tab');
        if (!tabName) return;
        botones.forEach(btn => btn.classList.toggle('activo', btn.dataset.tab === tabName));
        paneles.forEach(panel => panel.classList.toggle('activo', panel.id === `tab-${tabName}`));
        if (tabName === 'perfil' && typeof window.cargarPerfilAdmin === 'function') window.cargarPerfilAdmin();
        console.log(`📑 Pestaña admin activa: ${tabName}`);
    }
    function instalar() {
        const contenedor = document.getElementById('admin-tabs');
        if (!contenedor) return false;
        contenedor.addEventListener('click', function (event) {
            const boton = event.target.closest('.filtro[data-tab]');
            if (!boton || !contenedor.contains(boton)) return;
            event.preventDefault();
            activarPestana(boton.dataset.tab);
        });
        const inicial = contenedor.querySelector('.filtro.activo[data-tab]');
        if (inicial) activarPestana(inicial.dataset.tab);
        console.log('✅ Navegación de pestañas admin instalada.');
        return true;
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', instalar, { once: true });
    else instalar();
})();

(function inicializarCreacionAviso() {
    function valor(id) {
        const elemento = document.getElementById(id);
        return elemento ? String(elemento.value || '').trim() : '';
    }
    async function crearAviso(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const titulo = valor('titulo');
        const contenido = valor('contenido');
        const categoria = valor('categoria') || 'varios';
        if (!titulo) return alert('❌ El título del aviso es obligatorio.');
        if (!contenido) return alert('❌ La descripción del aviso es obligatoria.');
        const datos = { titulo, contenido, categoria, ubicacion: valor('ubicacion'), contacto: valor('contacto'), destacado: false, status: 'activo' };
        const fechaEvento = valor('fecha_evento');
        if (fechaEvento) datos.fecha_evento = fechaEvento;
        const imagenUrl = valor('imagen_url');
        if (imagenUrl) datos.imagen_url = imagenUrl;
        const videoUrl = valor('video_url');
        if (videoUrl) datos.video_url = videoUrl;
        try {
            const apiKey = localStorage.getItem('api_key');
            const usuario = API.getUsuarioActual();
            if (!apiKey || !usuario?.id) throw new Error('Sesión de usuario no disponible. Vuelve a iniciar sesión.');
            const resultado = await API.peticion('CREAR', { coleccion: 'AVISOS', datos }, apiKey);
            if (!resultado?.success) throw new Error(resultado?.error || 'Supabase rechazó la creación del aviso.');
            console.log('✅ CREAR AVISO: registro creado:', resultado.data);
            alert('✅ Aviso publicado correctamente');
            const form = document.getElementById('form-aviso');
            if (form) form.reset();
            window.location.reload();
        } catch (error) {
            console.error('❌ CREAR AVISO: error:', error);
            alert('❌ No se pudo publicar el aviso: ' + (error?.message || error));
        }
    }
    function instalar() {
        const form = document.getElementById('form-aviso');
        if (!form) return false;
        form.addEventListener('submit', crearAviso, true);
        console.log('✅ CREAR AVISO: handler Supabase instalado en #form-aviso.');
        return true;
    }
    function intentarInstalar() {
        if (instalar()) return;
        setTimeout(instalar, 500);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', intentarInstalar, { once: true });
    else intentarInstalar();
})();

// ==============================================================
// EDICIÓN DE AVISOS
// Se reemplaza el formulario legacy después de que admin.html haya
// instalado sus listeners. Así eliminamos también el listener que
// intenta escribir en #edit-categoria, elemento que no existe.
// ==============================================================
(function inicializarEdicionAviso() {
    function instalar() {
        const original = document.getElementById('form-editar');
        if (!original || original.dataset.supabaseEditReady === '1') return !!original;

        const form = original.cloneNode(true);
        form.removeAttribute('onsubmit');
        form.dataset.supabaseEditReady = '1';
        original.replaceWith(form);

        form.addEventListener('submit', async function (event) {
            event.preventDefault();
            event.stopImmediatePropagation();

            const obtener = id => document.getElementById(id);
            const valor = id => {
                const el = obtener(id);
                return el ? String(el.value || '').trim() : '';
            };

            const id = valor('edit-id');
            if (!id) return alert('❌ No se encontró el ID del aviso.');

            const datos = {
                titulo: valor('edit-titulo'),
                contenido: valor('edit-contenido'),
                ubicacion: valor('edit-ubicacion'),
                contacto: valor('edit-contacto'),
                imagen_url: valor('edit-imagen_url'),
                video_url: valor('edit-video_url')
            };

            const fecha = valor('edit-fecha_evento');
            if (fecha) datos.fecha_evento = fecha.split('T')[0];

            const chkDestacado = obtener('edit-destacado');
            if (chkDestacado) datos.destacado = !!chkDestacado.checked;

            try {
                const apiKey = localStorage.getItem('api_key');
                console.log('✏️ ACTUALIZAR AVISO: enviando:', { id, datos });
                const resultado = await API.peticion('ACTUALIZAR', { coleccion: 'AVISOS', id, datos }, apiKey);
                if (!resultado?.success) throw new Error(resultado?.error || 'No se pudo actualizar el aviso.');
                console.log('✅ ACTUALIZAR AVISO: registro actualizado:', resultado.data);
                alert('✅ Aviso actualizado correctamente');
                const modal = document.getElementById('modal-editar');
                if (modal) modal.style.display = 'none';
                location.reload();
            } catch (error) {
                console.error('❌ ACTUALIZAR AVISO:', error);
                alert('❌ Error al actualizar: ' + (error?.message || error));
            }
        }, true);

        console.log('✅ EDICIÓN AVISO: formulario legacy aislado y handler Supabase instalado.');
        return true;
    }

    function intentarInstalar() {
        if (instalar()) return;
        setTimeout(instalar, 1000);
    }

    setTimeout(intentarInstalar, 0);
})();

// ==============================================================
// OCULTAR AVISOS ELIMINADOS DEL LISTADO ADMINISTRATIVO
// ==============================================================
(function ocultarAvisosEliminadosAdmin() {
    let instalado = false;
    let intentos = 0;
    const maxIntentos = 100;

    function instalarFiltro() {
        if (instalado) return true;

        if (typeof window.renderizarTablaAvisos !== 'function') {
            intentos++;
            if (intentos >= maxIntentos) {
                console.warn('⚠️ No se pudo instalar el filtro de avisos eliminados.');
                return true;
            }
            return false;
        }

        const renderOriginal = window.renderizarTablaAvisos;

        window.renderizarTablaAvisos = function () {
            if (Array.isArray(todosLosAvisos)) {
                const antes = todosLosAvisos.length;
                todosLosAvisos = todosLosAvisos.filter(aviso => aviso?.status !== 'eliminado');
                const eliminados = antes - todosLosAvisos.length;

                if (eliminados > 0) {
                    console.log(`🗑️ ${eliminados} aviso(s) eliminado(s) ocultado(s) del panel administrativo.`);
                }
            }

            return renderOriginal.apply(this, arguments);
        };

        instalado = true;
        console.log('✅ Filtro admin instalado: los avisos con status="eliminado" no se muestran.');
        return true;
    }

    const timer = setInterval(() => {
        if (instalarFiltro()) clearInterval(timer);
    }, 100);

    setTimeout(() => clearInterval(timer), 10000);
})();

// ==============================================================
// AISLAR LOS ESTILOS DEL PANEL ADMIN
// `index2.css` es una hoja global pensada para la portada/listado
// público y redefine :root, *, body y otros selectores generales.
// En admin.html esto pisa parte del diseño administrativo propio.
// No modificamos index2.css porque otras páginas sí lo necesitan.
// ==============================================================
(function aislarEstilosAdmin() {
    function instalar() {
        const hojas = document.querySelectorAll('link[rel="stylesheet"]');
        hojas.forEach(hoja => {
            const href = hoja.getAttribute('href') || '';
            if (href === '/css/index2.css' || href.endsWith('/css/index2.css')) {
                hoja.remove();
                console.log('✅ admin.html: index2.css aislado para evitar conflicto de estilos.');
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', instalar, { once: true });
    } else {
        instalar();
    }
})();

// ==============================================================
// MÉTRICAS COMERCIALES DEL FOOTER
// Usa únicamente datos reales de Supabase. No se estiman
// interacciones a partir del número de avisos.
// ==============================================================
(function inicializarMetricasComercialesAdmin() {
    let ultimaFirma = '';
    let timer = null;

    function numero(valor) {
        const n = Number(valor);
        return Number.isFinite(n) ? n : 0;
    }

    function formatear(valor) {
        return numero(valor).toLocaleString('es-MX');
    }

    function actualizarElemento(id, valor) {
        const el = document.getElementById(id);
        if (el) el.textContent = formatear(valor);
    }

    function crearTopAlcance(avisos) {
        const footer = document.querySelector('.dashboard-footer .contenedor');
        if (!footer) return;

        let panel = document.getElementById('admin-top-alcance');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'admin-top-alcance';
            panel.className = 'dashboard-chart';
            panel.innerHTML = `
                <div class="chart-header">
                    <h4>Mayor alcance de avisos</h4>
                    <span style="color:#888;font-size:.75rem;">Vistas acumuladas</span>
                </div>
                <div id="admin-top-alcance-bars" style="display:flex;flex-direction:column;gap:12px;"></div>
                <div id="admin-top-alcance-note" style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.1);font-size:.7rem;color:#888;text-align:center;"></div>
            `;

            const resumen = document.getElementById('statsSummary');
            if (resumen) footer.insertBefore(panel, resumen);
            else footer.appendChild(panel);
        }

        const lista = (avisos || [])
            .map(a => ({
                titulo: String(a.titulo || 'Aviso sin título'),
                vistas: numero(a.vistas ?? a.visitas ?? a.visualizaciones),
                status: a.status
            }))
            .filter(a => a.status !== 'eliminado' && a.vistas > 0)
            .sort((a, b) => b.vistas - a.vistas)
            .slice(0, 5);

        const bars = document.getElementById('admin-top-alcance-bars');
        const note = document.getElementById('admin-top-alcance-note');
        if (!bars) return;

        if (!lista.length) {
            bars.innerHTML = '<div style="color:#888;font-size:.8rem;text-align:center;padding:12px;">Aún no hay vistas registradas.</div>';
            if (note) note.textContent = '';
            return;
        }

        const max = lista[0].vistas || 1;
        bars.innerHTML = lista.map((item, indice) => {
            const porcentaje = Math.max(4, Math.round((item.vistas / max) * 100));
            const titulo = item.titulo.length > 48 ? item.titulo.slice(0, 48) + '…' : item.titulo;
            return `
                <div style="display:grid;grid-template-columns:minmax(110px,1fr) 3fr auto;gap:10px;align-items:center;">
                    <span style="color:#ccc;font-size:.75rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${titulo.replace(/"/g, '&quot;')}">${indice + 1}. ${titulo}</span>
                    <div style="height:24px;background:rgba(255,255,255,.08);border-radius:12px;overflow:hidden;">
                        <div style="width:${porcentaje}%;height:100%;background:linear-gradient(90deg,#f5b042,#ff8c42);border-radius:12px;"></div>
                    </div>
                    <strong style="color:#f5b042;font-size:.8rem;min-width:55px;text-align:right;">${formatear(item.vistas)}</strong>
                </div>
            `;
        }).join('');

        if (note) note.textContent = 'El alcance corresponde a las vistas registradas por cada aviso.';
    }

    async function cargar() {
        const footer = document.querySelector('.dashboard-footer');
        if (!footer || typeof getSupabaseClient !== 'function') return;

        try {
            const client = await getSupabaseClient();

            const [usuariosResult, avisosResult] = await Promise.all([
                client
                    .from('usuarios')
                    .select('id, fecha_registro, ultimo_acceso, votos_positivos_recibidos, votos_negativos_recibidos')
                    .range(0, 9999),
                client
                    .from('avisos')
                    .select('id, titulo, created_at, status, vistas')
                    .range(0, 9999)
            ]);

            if (usuariosResult.error) throw usuariosResult.error;
            if (avisosResult.error) throw avisosResult.error;

            const usuarios = usuariosResult.data || [];
            const avisos = avisosResult.data || [];
            const visibles = avisos.filter(a => a.status !== 'eliminado');

            const totalUsuarios = usuarios.length;
            const totalAvisos = visibles.length;
            const activos = visibles.filter(a => a.status === 'activo').length;
            const totalVistas = visibles.reduce((s, a) => s + numero(a.vistas), 0);
            const votosPositivos = usuarios.reduce((s, u) => s + numero(u.votos_positivos_recibidos), 0);
            const votosNegativos = usuarios.reduce((s, u) => s + numero(u.votos_negativos_recibidos), 0);
            const totalVotos = votosPositivos + votosNegativos;
            const promedioVistas = totalAvisos ? totalVistas / totalAvisos : 0;
            const promedioVotos = totalAvisos ? totalVotos / totalAvisos : 0;

            const firma = [totalUsuarios, totalAvisos, activos, totalVistas, votosPositivos, votosNegativos].join('|');
            if (firma === ultimaFirma) return;
            ultimaFirma = firma;

            actualizarElemento('totalAvisos', totalAvisos);
            actualizarElemento('avisosActivos', activos);
            actualizarElemento('totalVisitas', totalVistas);
            actualizarElemento('totalInteracciones', totalVotos);
            actualizarElemento('totalUsuarios', totalUsuarios);

            const cards = document.querySelectorAll('.dashboard-footer .stat-card');
            cards.forEach(card => {
                const titulo = card.querySelector('h4');
                const etiqueta = card.querySelector('.stat-label');
                if (!titulo) return;
                if (titulo.textContent.trim().toLowerCase() === 'interacciones') {
                    titulo.textContent = 'Votos registrados';
                    if (etiqueta) etiqueta.textContent = 'positivos + negativos';
                }
                if (titulo.textContent.trim().toLowerCase() === 'total visitas') {
                    if (etiqueta) etiqueta.textContent = 'vistas acumuladas';
                }
            });

            const resumen = document.getElementById('statsSummary');
            if (resumen) {
                let extra = document.getElementById('admin-commercial-summary');
                if (!extra) {
                    extra = document.createElement('div');
                    extra.id = 'admin-commercial-summary';
                    extra.style.cssText = 'display:flex;justify-content:center;gap:30px;flex-wrap:wrap;margin-top:12px;padding:12px 20px;background:rgba(255,255,255,.03);border-radius:16px;font-size:.72rem;color:#888;';
                    resumen.insertAdjacentElement('afterend', extra);
                }
                extra.innerHTML = `
                    <span>Alcance promedio por aviso: <strong style="color:#f5b042;">${promedioVistas.toFixed(1)}</strong></span>
                    <span>Votos promedio por aviso: <strong style="color:#f5b042;">${promedioVotos.toFixed(1)}</strong></span>
                    <span>👍 ${formatear(votosPositivos)} · 👎 ${formatear(votosNegativos)}</span>
                `;
            }

            crearTopAlcance(visibles);
            console.log('📊 Métricas comerciales reales actualizadas:', {
                totalUsuarios,
                totalAvisos,
                activos,
                totalVistas,
                votosPositivos,
                votosNegativos,
                totalVotos
            });
        } catch (error) {
            console.error('❌ No se pudieron cargar las métricas comerciales:', error);
        }
    }

    function observarFooter() {
        const contenedor = document.getElementById('footer-container');
        if (!contenedor) return;

        const observer = new MutationObserver(() => {
            if (document.querySelector('.dashboard-footer')) {
                cargar();
                if (!timer) timer = setInterval(cargar, 60000);
            }
        });
        observer.observe(contenedor, { childList: true, subtree: true });

        if (document.querySelector('.dashboard-footer')) {
            cargar();
            timer = setInterval(cargar, 60000);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', observarFooter, { once: true });
    } else {
        observarFooter();
    }
})();
