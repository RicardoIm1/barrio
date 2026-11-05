// ==========================================
// 1. Configuración de Supabase
// ==========================================
const SUPABASE_URL = 'https://gnjaumpjerbbwlkcgxqa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduamF1bXBqZXJiYndsa2NneHFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MjQ5ODksImV4cCI6MjEwMzUwMDk4OX0.B6QRJN4gg1NuTmv-RyFBeWQaTmlFUoOYDZlkYaiFUjU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let eventoActualId = null; 

// DOM - Eventos
const formEvento = document.getElementById('formEvento');
const modalEvento = document.getElementById('modalEvento');
const btnNuevoEvento = document.getElementById('btnNuevoEvento');
const btnCerrarModalEvento = document.getElementById('btnCerrarModalEvento');
const seccionEventos = document.getElementById('seccionEventos');

// DOM - Invitados
const seccionInvitados = document.getElementById('seccionInvitados');
const modalInvitado = document.getElementById('modalInvitado');
const formInvitado = document.getElementById('formInvitado');
const btnNuevoInvitado = document.getElementById('btnNuevoInvitado');
const btnCerrarModalInvitado = document.getElementById('btnCerrarModal');
const inputWhatsapp = document.getElementById('inputWhatsapp');
const btnVolverEventos = document.getElementById('btnVolverEventos');

// DOM - Planning
const seccionPlanning = document.getElementById('seccionPlanning');
const btnVolverEventosDesdePlanning = document.getElementById('btnVolverEventosDesdePlanning');
const btnVerChecklist = document.getElementById('btnVerChecklist');
const btnNuevoItinerario = document.getElementById('btnNuevoItinerario');
const tablaItinerarioWrapper = document.getElementById('tablaItinerarioWrapper');
const tablaChecklistWrapper = document.getElementById('tablaChecklistWrapper');
const modalItinerario = document.getElementById('modalItinerario');
const formItinerario = document.getElementById('formItinerario');
const btnCerrarModalItinerario = document.getElementById('btnCerrarModalItinerario');
const modalChecklist = document.getElementById('modalChecklist');
const formChecklist = document.getElementById('formChecklist');
const btnCerrarModalChecklist = document.getElementById('btnCerrarModalChecklist');

let vistaPlanningActual = 'itinerario';

// ==========================================
// 🛡️ SANITIZACIÓN Y MÁSCARA
// ==========================================
function sanitizarTexto(texto) {
    if (!texto) return '';
    return texto.replace(/<[^>]*>?/gm, '').trim().replace(/\s+/g, ' ');
}

function formatearTelefonoVisual(valor) {
    let numeros = valor.replace(/\D/g, '');
    if (!numeros.startsWith('52')) numeros = '52' + numeros;
    numeros = numeros.slice(0, 12);
    let formateado = '+52';
    if (numeros.length > 2) formateado += ' (' + numeros.slice(2, 5);
    if (numeros.length > 5) formateado += ') ' + numeros.slice(5, 8);
    if (numeros.length > 8) formateado += '-' + numeros.slice(8, 12);
    return formateado;
}

inputWhatsapp.addEventListener('input', (e) => {
    e.target.value = formatearTelefonoVisual(e.target.value);
});

// ==========================================
// 📊 ESTADÍSTICAS
// ==========================================
async function actualizarEstadisticas() {
    try {
        const { count: totalEventos } = await supabaseClient.schema('piscis').from('eventos').select('*', { count: 'exact', head: true });
        const { count: totalInvitados } = await supabaseClient.schema('piscis').from('invitados').select('*', { count: 'exact', head: true });
        const { count: totalPases } = await supabaseClient.schema('piscis').from('invitados').select('*', { count: 'exact', head: true }).eq('estado_pase', 'guardado_en_wallet');
        const { data: fondoData } = await supabaseClient.schema('piscis').from('fondo_comun').select('monto').eq('estado', 'completado');

        let totalFondo = 0;
        if (fondoData && fondoData.length > 0) totalFondo = fondoData.reduce((sum, item) => sum + Number(item.monto), 0);

        document.getElementById('statEventos').innerText = totalEventos || 0;
        document.getElementById('statInvitados').innerText = totalInvitados || 0;
        document.getElementById('statPases').innerText = totalPases || 0;
        document.getElementById('statFondo').innerText = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(totalFondo);
    } catch (error) { console.error("Error stats:", error); }
}

// ==========================================
// 📅 EVENTOS
// ==========================================
async function cargarEventos() {
    const tbody = document.querySelector('#tablaEventos');
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#999; padding: 2rem;">Cargando eventos...</td></tr>`;
    try {
        const { data: eventos, error } = await supabaseClient.schema('piscis').from('eventos').select('*').order('fecha_evento', { ascending: true });
        if (error) throw error;
        if (!tbody) return;
        tbody.innerHTML = '';
        if (eventos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#999;">No hay eventos creados aún.</td></tr>`;
            return;
        }
        eventos.forEach(ev => {
            let fechaFormateada = 'Sin fecha';
            if (ev.fecha_evento) {
                const partes = ev.fecha_evento.split('-');
                if (partes.length === 3) fechaFormateada = `${partes[2]}/${partes[1]}/${partes[0]}`;
            }
            const fila = `
                <tr>
                    <td><strong>${ev.nombre_evento || 'Sin nombre'}</strong></td>
                    <td style="text-transform: capitalize;">${ev.tipo_evento || 'N/A'}</td>
                    <td>${fechaFormateada}</td>
                    <td>${ev.lugar_nombre || 'Sin lugar'}</td>
                    <td>
                        <button class="btn-sm btn-edit" onclick="verInvitados('${ev.id}', '${ev.nombre_evento}')">👥 Invitados</button>
                        <button class="btn-sm" onclick="verPlanning('${ev.id}', '${ev.nombre_evento}')">📋 Planning</button>
                        <button class="btn-sm" onclick="abrirModalEditarEvento('${ev.id}')">✏️</button>
                        <button class="btn-sm btn-delete" onclick="eliminarEvento('${ev.id}')">🗑️</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += fila;
        });
    } catch (error) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Error al cargar eventos.</td></tr>`;
    }
}

btnNuevoEvento.addEventListener('click', () => {
    formEvento.reset();
    document.getElementById('eventoId').value = '';
    document.getElementById('modalTituloEvento').innerText = 'Nuevo Evento';
    modalEvento.classList.remove('hidden');
});
btnCerrarModalEvento.addEventListener('click', () => modalEvento.classList.add('hidden'));

window.abrirModalEditarEvento = async (id) => {
    const { data: ev, error } = await supabaseClient.schema('piscis').from('eventos').select('*').eq('id', id).single();
    if (error || !ev) return;
    document.getElementById('eventoId').value = ev.id;
    document.getElementById('inputNombreEvento').value = ev.nombre_evento;
    document.getElementById('inputTipoEvento').value = ev.tipo_evento;
    document.getElementById('inputFechaEvento').value = ev.fecha_evento;
    document.getElementById('inputLugarEvento').value = ev.lugar_nombre || '';
    document.getElementById('modalTituloEvento').innerText = 'Editar Evento';
    modalEvento.classList.remove('hidden');
};

formEvento.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('eventoId').value;
    const nombre = sanitizarTexto(document.getElementById('inputNombreEvento').value);
    const tipo = document.getElementById('inputTipoEvento').value;
    const fecha = document.getElementById('inputFechaEvento').value;
    const lugar = sanitizarTexto(document.getElementById('inputLugarEvento').value);
    const btnGuardar = document.getElementById('btnGuardarEvento');
    btnGuardar.innerText = 'Guardando...';
    btnGuardar.disabled = true;
    try {
        const datosEvento = { nombre_evento: nombre, tipo_evento: tipo, fecha_evento: fecha, lugar_nombre: lugar, anfitrion_nombre: 'Admin' };
        if (id) {
            const { error } = await supabaseClient.schema('piscis').from('eventos').update(datosEvento).eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient.schema('piscis').from('eventos').insert([datosEvento]);
            if (error) throw error;
        }
        modalEvento.classList.add('hidden');
        cargarEventos(); 
        actualizarEstadisticas();
    } catch (error) {
        alert("Error al guardar evento: " + error.message);
    } finally {
        btnGuardar.innerText = 'Guardar';
        btnGuardar.disabled = false;
    }
});

window.eliminarEvento = async (id) => {
    if (!confirm('¿Seguro que quieres borrar este evento? Se borrarán todos sus invitados y planning.')) return;
    try {
        const { error } = await supabaseClient.schema('piscis').from('eventos').delete().eq('id', id);
        if (error) throw error;
        cargarEventos();
        actualizarEstadisticas();
    } catch (error) { alert("Error al eliminar: " + error.message); }
};

// ==========================================
// 👥 INVITADOS
// ==========================================
async function cargarInvitados(eventoId, nombreEvento) {
    seccionEventos.classList.add('hidden');
    seccionPlanning.classList.add('hidden');
    seccionInvitados.classList.remove('hidden');
    document.getElementById('tituloInvitados').innerText = `Invitados de: ${nombreEvento}`;
    eventoActualId = String(eventoId).trim();
    const tbody = document.querySelector('#tablaInvitados');
    if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#999; padding: 2rem;">Cargando invitados...</td></tr>`;
    try {
        const { data: invitados, error } = await supabaseClient.schema('piscis').from('invitados').select('*').eq('evento_id', eventoActualId);
        if (error) throw error;
        if (!tbody) return;
        tbody.innerHTML = '';
        if (invitados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#999;">No hay invitados aún.</td></tr>`;
            return;
        }
        invitados.forEach(inv => {
            let badgeClass = inv.estado_pase === 'guardado_en_wallet' ? 'badge-success' : 'badge-pending';
            let badgeText = inv.estado_pase === 'guardado_en_wallet' ? 'Guardado en Wallet'