// ==============================================================
// ADMIN.JS
//
// El panel admin actual contiene su controlador principal dentro
// de admin.html. Durante la migración a Supabase evitamos cargar
// un segundo controlador que duplique eventos y peticiones.
//
// Este archivo se encarga de la navegación de pestañas y de cargar
// el perfil del usuario autenticado desde Supabase.
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
        return fecha.toLocaleString('es-MX', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    }

    function mostrarPerfil(perfil) {
        const contenedor = document.getElementById('perfil-info');
        if (!contenedor) return;

        const p = perfil || {};
        const nombre = p.nombre || p.name || 'Usuario';
        const email = p.email || 'No disponible';
        const rol = p.rol || 'usuario';
        const telefono = p.telefono || 'No registrado';
        const categorias = Array.isArray(p.categorias)
            ? p.categorias.join(', ')
            : (p.categorias || 'No registradas');

        contenedor.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;">
                <div class="campo">
                    <label>Nombre</label>
                    <div>${escapar(nombre)}</div>
                </div>
                <div class="campo">
                    <label>Correo electrónico</label>
                    <div>${escapar(email)}</div>
                </div>
                <div class="campo">
                    <label>Rol</label>
                    <div>${escapar(rol)}</div>
                </div>
                <div class="campo">
                    <label>Teléfono</label>
                    <div>${escapar(telefono)}</div>
                </div>
                <div class="campo">
                    <label>Categorías</label>
                    <div>${escapar(categorias)}</div>
                </div>
                <div class="campo">
                    <label>Estado</label>
                    <div>${p.activo === false ? 'Inactivo' : 'Activo'}</div>
                </div>
                <div class="campo">
                    <label>Fecha de registro</label>
                    <div>${escapar(formatearFecha(p.fecha_registro))}</div>
                </div>
                <div class="campo">
                    <label>Último acceso</label>
                    <div>${escapar(formatearFecha(p.ultimo_acceso))}</div>
                </div>
                <div class="campo">
                    <label>Puntos de confianza</label>
                    <div>${escapar(p.puntos_confianza ?? 0)}</div>
                </div>
                <div class="campo">
                    <label>Nivel</label>
                    <div>${escapar(p.nivel || 'Sin nivel')}</div>
                </div>
                <div class="campo">
                    <label>Avisos publicados</label>
                    <div>${escapar(p.avisos_publicados ?? 0)}</div>
                </div>
                <div class="campo">
                    <label>Reportes recibidos</label>
                    <div>${escapar(p.reportes_recibidos ?? 0)}</div>
                </div>
            </div>
        `;
    }

    async function cargarPerfil() {
        const contenedor = document.getElementById('perfil-info');
        if (!contenedor) return;

        // Mostrar de inmediato los datos compatibles ya guardados por auth.js.
        try {
            const local = JSON.parse(localStorage.getItem('usuario') || 'null');
            if (local) mostrarPerfil(local);
        } catch (error) {
            console.warn('⚠️ No se pudo leer el perfil local:', error);
        }

        if (!window.supabaseClient) {
            console.warn('⚠️ Supabase no está disponible para cargar el perfil.');
            return;
        }

        try {
            const { data: authData, error: authError } =
                await window.supabaseClient.auth.getUser();

            if (authError || !authData?.user?.id) {
                console.warn('⚠️ No se pudo obtener el usuario autenticado:', authError);
                return;
            }

            const { data, error } = await window.supabaseClient
                .from('usuarios')
                .select(`
                    id,
                    email,
                    nombre,
                    rol,
                    categorias,
                    activo,
                    telefono,
                    fecha_registro,
                    ultimo_acceso,
                    puntos_confianza,
                    nivel,
                    avisos_publicados,
                    reportes_recibidos,
                    reportes_realizados,
                    votos_positivos_recibidos,
                    votos_negativos_recibidos,
                    fecha_verificacion,
                    sancion_hasta
                `)
                .eq('id', authData.user.id)
                .maybeSingle();

            if (error) {
                console.error('❌ Error cargando perfil desde Supabase:', error);
                return;
            }

            if (data) {
                mostrarPerfil(data);
                console.log('✅ Perfil cargado desde Supabase:', data.email);
            } else {
                console.warn('⚠️ No existe perfil en usuarios para:', authData.user.id);
            }
        } catch (error) {
            console.error('❌ Error inesperado cargando perfil:', error);
        }
    }

    // Exponerlo para que la navegación pueda cargarlo al entrar en la pestaña.
    window.cargarPerfilAdmin = cargarPerfil;
})();

(function inicializarPestanasAdmin() {
    function activarPestana(tabName) {
        const botones = document.querySelectorAll('#admin-tabs .filtro[data-tab]');
        const paneles = document.querySelectorAll('.tab');

        if (!tabName) return;

        botones.forEach(btn => {
            btn.classList.toggle('activo', btn.dataset.tab === tabName);
        });

        paneles.forEach(panel => {
            panel.classList.toggle('activo', panel.id === `tab-${tabName}`);
        });

        if (tabName === 'perfil' && typeof window.cargarPerfilAdmin === 'function') {
            window.cargarPerfilAdmin();
        }

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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', instalar, { once: true });
    } else {
        instalar();
    }
})();
