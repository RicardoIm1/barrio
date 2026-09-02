// ==============================================================
// ADMIN.JS
//
// El panel admin actual contiene su controlador principal dentro
// de admin.html. Durante la migración a Supabase evitamos cargar
// un segundo controlador que duplique eventos y peticiones.
//
// Este archivo sí se encarga de la navegación de pestañas, porque
// admin.html define los botones y paneles pero no tenía un listener
// que cambiara la clase .activo.
// ==============================================================

console.log('ℹ️ admin.js: controlador embebido de admin.html activo.');

(function inicializarPestanasAdmin() {
    function activarPestana(tabName) {
        const botones = document.querySelectorAll('#admin-tabs .filtro[data-tab]');
        const paneles = document.querySelectorAll('.tab');

        if (!tabName) return;

        // Quitar estado activo de todos los botones y paneles.
        botones.forEach(btn => {
            btn.classList.toggle('activo', btn.dataset.tab === tabName);
        });

        paneles.forEach(panel => {
            panel.classList.toggle('activo', panel.id === `tab-${tabName}`);
        });

        console.log(`📑 Pestaña admin activa: ${tabName}`);
    }

    function instalar() {
        const contenedor = document.getElementById('admin-tabs');
        if (!contenedor) return false;

        // Delegación de eventos: funciona aunque el DOM se termine de
        // construir después de cargar este archivo.
        contenedor.addEventListener('click', function (event) {
            const boton = event.target.closest('.filtro[data-tab]');
            if (!boton || !contenedor.contains(boton)) return;

            event.preventDefault();
            activarPestana(boton.dataset.tab);
        });

        // Sincronizar el estado inicial con el panel que ya viene activo.
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
