// ==========================================
// 1. Configuración de Supabase
// ==========================================
const SUPABASE_URL = 'https://gnjaumpjerbbwlkcgxqa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduamF1bXBqZXJiYndsa2NneHFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MjQ5ODksImV4cCI6MjEwMzUwMDk4OX0.B6QRJN4gg1NuTmv-RyFBeWQaTmlFUoOYDZlkYaiFUjU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variables globales
let eventoActualId = null; 
let tipoEventoActual = null;

// Elementos del DOM - Eventos
const formEvento = document.getElementById('formEvento');
const modalEvento = document.getElementById('modalEvento');
const btnNuevoEvento = document.getElementById('btnNuevoEvento');
const btnCerrarModalEvento = document.getElementById('btnCerrarModalEvento');
const seccionEventos = document.getElementById('seccionEventos');
const seccionInvitados = document.getElementById('seccionInvitados');

// Elementos del DOM - Invitados
const modalInvitado = document.getElementById('modalInvitado');
const formInvitado = document.getElementById('formInvitado');
const btnNuevoInvitado = document.getElementById('btnNuevoInvitado');
const btnCerrarModalInvitado = document.getElementById('btnCerrarModal');
const btnVolverEventos = document.getElementById('btnVolverEventos');
const inputWhatsapp = document.getElementById('inputWhatsapp');

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
// 📅 READ: Cargar EVENTOS
// ==========================================
async function cargarEventos() {
    const tbody = document.querySelector('#tablaEventos');
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#999; padding: 2rem;">Cargando eventos...</td></tr>`;

    try {
        const { data: eventos, error } = await supabaseClient
            .schema('piscis').from('eventos').select('*').order('fecha_evento', { ascending: true });
        if (error) throw error;

        // Actualizar stats
        const statNumbers = document.querySelectorAll('.stat-number');
        if (statNumbers.length > 0) statNumbers[0].innerText = eventos.length;

        if (!tbody) return;
        tbody.innerHTML = '';

        // Si no hay eventos, mostramos mensaje amigable
        if (eventos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#999;">No hay eventos creados aún.</td></tr>`;
            return;
        }

        eventos.forEach(ev => {
            // 🛡️ FORMATEO DE FECHA SEGURO (Sin desfase de zona horaria)
            let fechaFormateada = 'Sin fecha';
            if (ev.fecha_evento) {
                // Si viene como "2026-05-31", lo partimos y lo unimos como "31/05/2026"
                const partes = ev.fecha_evento.split('-');
                if (partes.length === 3) {
                    fechaFormateada = `${partes[2]}/${partes[1]}/${partes[0]}`;
                }
            }

            const fila = `
                <tr>
                    <td><strong>${ev.nombre_evento || 'Sin nombre'}</strong></td>
                    <td style="text-transform: capitalize;">${ev.tipo_evento || 'N/A'}</td>
                    <td>${fechaFormateada}</td>
                    <td>${ev.lugar_nombre || 'Sin lugar'}</td>
                    <td>
                        <button class="btn-sm btn-edit" onclick="verInvitados('${ev.id}', '${ev.nombre_evento}')">Ver Invitados</button>
                        <button class="btn-sm" onclick="abrirModalEditarEvento('${ev.id}')">✏️</button>
                        <button class="btn-sm btn-delete" onclick="eliminarEvento('${ev.id}')">🗑️</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += fila;
        });
    } catch (error) {
        // Aquí imprimimos el error real para saber qué pasa (luego lo quitamos)
        console.error("Detalle del error:", error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Error al cargar eventos: ${error.message}</td></tr>`;
    }
}

// ==========================================
// 👥 READ: Cargar INVITADOS (De un evento específico)
// ==========================================
async function cargarInvitados(eventoId, nombreEvento) {
    // Cambiamos de vista
    seccionEventos.classList.add('hidden');
    seccionInvitados.classList.remove('hidden');
    document.getElementById('tituloInvitados').innerText = `Invitados de: ${nombreEvento}`;
    eventoActualId = eventoId;

    const tbody = document.querySelector('#tablaInvitados');
    if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#999; padding: 2rem;">Cargando invitados...</td></tr>`;

    try {
        const { data: invitados, error } = await supabaseClient
            .schema('piscis').from('invitados').select('*').eq('evento_id', eventoId);
        if (error) throw error;

        // Actualizar stats
        document.querySelectorAll('.stat-number')[1].innerText = invitados.length;

        if (!tbody) return;
        tbody.innerHTML = '';

        if (invitados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#999;">No hay invitados aún. ¡Añade el primero!</td></tr>`;
            return;
        }

        invitados.forEach(inv => {
            let badgeClass = inv.estado_pase === 'guardado_en_wallet' ? 'badge-success' : 'badge-pending';
            let badgeText = inv.estado_pase === 'guardado_en_wallet' ? 'Guardado en Wallet' : 'Pendiente';
            const telVisual = inv.whatsapp ? formatearTelefonoVisual(inv.whatsapp) : 'Sin número';

            const fila = `
                <tr>
                    <td>${inv.nombre}</td>
                    <td>${telVisual}</td>
                    <td><span class="badge ${badgeClass}">${badgeText}</span></td>
                    <td>
                        <button class="btn-sm btn-edit" onclick="abrirModalEditarInvitado('${inv.id}', '${inv.nombre}', '${inv.whatsapp || ''}')">Editar</button>
                        <button class="btn-sm btn-delete" onclick="eliminarInvitado('${inv.id}')">Borrar</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += fila;
        });

    } catch (error) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Error al cargar invitados.</td></tr>`;
    }
}

// ==========================================
// 🔄 NAVEGACIÓN
// ==========================================
window.verInvitados = (id, nombre) => cargarInvitados(id, nombre);

btnVolverEventos.addEventListener('click', () => {
    seccionInvitados.classList.add('hidden');
    seccionEventos.classList.remove('hidden');
    eventoActualId = null;
    cargarEventos(); // Recargamos eventos por si cambió algo
});

// ==========================================
// ✍️ CREATE & UPDATE: EVENTOS
// ==========================================
btnNuevoEvento.addEventListener('click', () => {
    formEvento.reset();
    document.getElementById('eventoId').value = '';
    document.getElementById('modalTituloEvento').innerText = 'Nuevo Evento';
    modalEvento.classList.remove('hidden');
});

btnCerrarModalEvento.addEventListener('click', () => modalEvento.classList.add('hidden'));

window.abrirModalEditarEvento = async (id) => {
    // Buscamos los datos del evento para llenar el formulario
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
        const datosEvento = { 
            nombre_evento: nombre, 
            tipo_evento: tipo, 
            fecha_evento: fecha, 
            lugar_nombre: lugar,
            anfitrion_nombre: 'Admin' // Placeholder por ahora
        };

        if (id) {
            const { error } = await supabaseClient.schema('piscis').from('eventos').update(datosEvento).eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient.schema('piscis').from('eventos').insert([datosEvento]);
            if (error) throw error;
        }
        
        modalEvento.classList.add('hidden');
        cargarEventos(); 

    } catch (error) {
        alert("Error al guardar evento: " + error.message);
    } finally {
        btnGuardar.innerText = 'Guardar';
        btnGuardar.disabled = false;
    }
});

window.eliminarEvento = async (id) => {
    if (!confirm('¿Seguro que quieres borrar este evento? Se borrarán todos sus invitados.')) return;
    try {
        const { error } = await supabaseClient.schema('piscis').from('eventos').delete().eq('id', id);
        if (error) throw error;
        cargarEventos();
    } catch (error) {
        alert("Error al eliminar: " + error.message);
    }
};

// ==========================================
// ✍️ CREATE & UPDATE: INVITADOS
// ==========================================
btnNuevoInvitado.addEventListener('click', () => {
    formInvitado.reset();
    document.getElementById('invitadoId').value = '';
    document.getElementById('modalTitulo').innerText = 'Nuevo Invitado';
    inputWhatsapp.value = '+52 '; 
    modalInvitado.classList.remove('hidden');
});

btnCerrarModalInvitado.addEventListener('click', () => modalInvitado.classList.add('hidden'));

window.abrirModalEditarInvitado = (id, nombre, whatsapp) => {
    document.getElementById('invitadoId').value = id;
    document.getElementById('inputNombre').value = nombre;
    inputWhatsapp.value = whatsapp ? formatearTelefonoVisual(whatsapp) : '+52 ';
    document.getElementById('modalTitulo').innerText = 'Editar Invitado';
    modalInvitado.classList.remove('hidden');
};

formInvitado.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!eventoActualId) return alert("Error: No hay evento seleccionado.");

    const id = document.getElementById('invitadoId').value;
    const nombreLimpio = sanitizarTexto(document.getElementById('inputNombre').value);
    const whatsappLimpio = inputWhatsapp.value.replace(/\D/g, '');

    if (whatsappLimpio.length > 2 && whatsappLimpio.length < 12) {
        return alert("Ingresa un número de WhatsApp válido (10 dígitos).");
    }

    const btnGuardar = document.getElementById('btnGuardar');
    btnGuardar.innerText = 'Guardando...';
    btnGuardar.disabled = true;

    try {
        if (id) {
            const { error } = await supabaseClient.schema('piscis').from('invitados')
                .update({ nombre: nombreLimpio, whatsapp: whatsappLimpio }).eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient.schema('piscis').from('invitados')
                .insert([{ evento_id: eventoActualId, nombre: nombreLimpio, whatsapp: whatsappLimpio, estado_pase: 'pendiente' }]);
            if (error) throw error;
        }
        
        modalInvitado.classList.add('hidden');
        // Recargamos los invitados del evento actual
        const titulo = document.getElementById('tituloInvitados').innerText.replace('Invitados de: ', '');
        cargarInvitados(eventoActualId, titulo); 

    } catch (error) {
        alert("Error al guardar invitado: " + error.message);
    } finally {
        btnGuardar.innerText = 'Guardar';
        btnGuardar.disabled = false;
    }
});

window.eliminarInvitado = async (id) => {
    if (!confirm('¿Estás seguro de eliminar a este invitado?')) return;
    try {
        const { error } = await supabaseClient.schema('piscis').from('invitados').delete().eq('id', id);
        if (error) throw error;
        const titulo = document.getElementById('tituloInvitados').innerText.replace('Invitados de: ', '');
        cargarInvitados(eventoActualId, titulo);
    } catch (error) {
        alert("Error al eliminar: " + error.message);
    }
};

// ==========================================
// 🚀 INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    cargarEventos();
});