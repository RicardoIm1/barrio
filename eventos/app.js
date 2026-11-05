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
                </tr>`;
            tbody.innerHTML += fila;
        });
    } catch (error) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Error al cargar invitados.</td></tr>`;
    }
}

window.verInvitados = (id, nombre) => cargarInvitados(id, nombre);
btnVolverEventos.addEventListener('click', () => {
    seccionInvitados.classList.add('hidden');
    seccionPlanning.classList.add('hidden');
    seccionEventos.classList.remove('hidden');
    eventoActualId = null;
    cargarEventos(); 
    actualizarEstadisticas();
});

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
    if (whatsappLimpio.length > 2 && whatsappLimpio.length < 12) return alert("Ingresa un número válido.");
    const btnGuardar = document.getElementById('btnGuardar');
    btnGuardar.innerText = 'Guardando...';
    btnGuardar.disabled = true;
    try {
        if (id) {
            const { error } = await supabaseClient.schema('piscis').from('invitados').update({ nombre: nombreLimpio, whatsapp: whatsappLimpio }).eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient.schema('piscis').from('invitados').insert([{ evento_id: eventoActualId, nombre: nombreLimpio, whatsapp: whatsappLimpio, estado_pase: 'pendiente' }]);
            if (error) throw error;
        }
        modalInvitado.classList.add('hidden');
        const titulo = document.getElementById('tituloInvitados').innerText.replace('Invitados de: ', '');
        cargarInvitados(eventoActualId, titulo); 
        actualizarEstadisticas();
    } catch (error) { alert("Error al guardar invitado: " + error.message); } 
    finally { btnGuardar.innerText = 'Guardar'; btnGuardar.disabled = false; }
});

window.eliminarInvitado = async (id) => {
    if (!confirm('¿Estás seguro de eliminar a este invitado?')) return;
    try {
        const { error } = await supabaseClient.schema('piscis').from('invitados').delete().eq('id', id);
        if (error) throw error;
        const titulo = document.getElementById('tituloInvitados').innerText.replace('Invitados de: ', '');
        cargarInvitados(eventoActualId, titulo);
        actualizarEstadisticas();
    } catch (error) { alert("Error al eliminar: " + error.message); }
};

// ==========================================
// 📋 PLANNING (ITINERARIO Y CHECKLIST)
// ==========================================
window.verPlanning = (id, nombre) => {
    eventoActualId = String(id).trim();
    seccionEventos.classList.add('hidden');
    seccionInvitados.classList.add('hidden');
    seccionPlanning.classList.remove('hidden');
    document.getElementById('tituloPlanning').innerText = `Planning: ${nombre}`;
    
    vistaPlanningActual = 'itinerario';
    tablaItinerarioWrapper.classList.remove('hidden');
    tablaChecklistWrapper.classList.add('hidden');
    btnVerChecklist.innerText = '📋 Checklist';
    
    cargarItinerario();
};

btnVolverEventosDesdePlanning.addEventListener('click', () => {
    seccionPlanning.classList.add('hidden');
    seccionEventos.classList.remove('hidden');
    eventoActualId = null;
    cargarEventos();
    actualizarEstadisticas();
});

btnVerChecklist.addEventListener('click', () => {
    if (vistaPlanningActual === 'itinerario') {
        vistaPlanningActual = 'checklist';
        tablaItinerarioWrapper.classList.add('hidden');
        tablaChecklistWrapper.classList.remove('hidden');
        btnVerChecklist.innerText = '⏰ Itinerario';
        document.getElementById('btnNuevoItinerario').classList.add('hidden');
        cargarChecklist();
    } else {
        vistaPlanningActual = 'itinerario';
        tablaChecklistWrapper.classList.add('hidden');
        tablaItinerarioWrapper.classList.remove('hidden');
        btnVerChecklist.innerText = '📋 Checklist';
        document.getElementById('btnNuevoItinerario').classList.remove('hidden');
        cargarItinerario();
    }
});

// --- ITINERARIO CRUD (CON FECHA) ---
async function cargarItinerario() {
    const tbody = document.getElementById('tablaItinerario');
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#999; padding: 2rem;">Cargando itinerario...</td></tr>`;
    try {
        const { data, error } = await supabaseClient.schema('piscis').from('planning_evento')
            .select('*').eq('evento_id', eventoActualId)
            .order('fecha_actividad', { ascending: true })
            .order('hora_inicio', { ascending: true });
        
        if (error) throw error;
        tbody.innerHTML = '';
        
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#999;">No hay actividades en el itinerario.</td></tr>`;
            return;
        }
        
        data.forEach(item => {
            const hora = item.hora_inicio ? item.hora_inicio.substring(0, 5) : '--:--';
            
            let fechaFmt = '-';
            if (item.fecha_actividad) {
                const p = item.fecha_actividad.split('-');
                if (p.length === 3) fechaFmt = `${p[2]}/${p[1]}/${p[0]}`;
            }

            const claseTachado = item.completado ? 'text-tachado' : '';
            tbody.innerHTML += `
                <tr>
                    <td>${fechaFmt}</td>
                    <td><strong>${hora}</strong></td>
                    <td class="${claseTachado}">${item.titulo}</td>
                    <td>${item.responsable || '-'}</td>
                    <td><input type="checkbox" class="checkbox-custom" ${item.completado ? 'checked' : ''} onchange="toggleItinerario('${item.id}', this.checked)"></td>
                    <td>
                        <button class="btn-sm btn-delete" onclick="eliminarItinerario('${item.id}')">🗑️</button>
                    </td>
                </tr>`;
        });
    } catch (error) { 
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Error al cargar.</td></tr>`; 
    }
}

// Manejador del botón "+ Añadir" (Itinerario o Checklist)
document.getElementById('btnNuevoItinerario').addEventListener('click', () => {
    if (vistaPlanningActual === 'itinerario') {
        formItinerario.reset();
        document.getElementById('itinerarioId').value = '';
        document.getElementById('modalTituloItinerario').innerText = 'Nueva Actividad';
        // Prellenamos la fecha con el día de hoy
        document.getElementById('inputFechaActividad').value = new Date().toISOString().split('T')[0];
        modalItinerario.classList.remove('hidden');
    } else {
        formChecklist.reset();
        document.getElementById('checklistId').value = '';
        document.getElementById('modalTituloChecklist').innerText = 'Nueva Tarea';
        modalChecklist.classList.remove('hidden');
    }
});

btnCerrarModalItinerario.addEventListener('click', () => modalItinerario.classList.add('hidden'));

formItinerario.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('itinerarioId').value;
    const titulo = sanitizarTexto(document.getElementById('inputTituloActividad').value);
    const fecha_actividad = document.getElementById('inputFechaActividad').value;
    const hora_inicio = document.getElementById('inputHoraInicio').value;
    const responsable = sanitizarTexto(document.getElementById('inputResponsable').value);
    
    const btnGuardar = document.getElementById('btnGuardarItinerario');
    btnGuardar.innerText = 'Guardando...';
    btnGuardar.disabled = true;
    
    try {
        const datos = { titulo, fecha_actividad, hora_inicio, responsable };
        if (id) {
            const { error } = await supabaseClient.schema('piscis').from('planning_evento').update(datos).eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient.schema('piscis').from('planning_evento').insert([{ evento_id: eventoActualId, ...datos }]);
            if (error) throw error;
        }
        modalItinerario.classList.add('hidden');
        cargarItinerario();
    } catch (error) { alert("Error: " + error.message); }
    finally { btnGuardar.innerText = 'Guardar'; btnGuardar.disabled = false; }
});

window.toggleItinerario = async (id, completado) => {
    try {
        const { error } = await supabaseClient.schema('piscis').from('planning_evento').update({ completado }).eq('id', id);
        if (error) throw error;
        cargarItinerario();
    } catch (error) { alert("Error al actualizar"); }
};

window.eliminarItinerario = async (id) => {
    if (!confirm('¿Eliminar esta actividad?')) return;
    try {
        const { error } = await supabaseClient.schema('piscis').from('planning_evento').delete().eq('id', id);
        if (error) throw error;
        cargarItinerario();
    } catch (error) { alert("Error al eliminar"); }
};

// --- CHECKLIST CRUD ---
async function cargarChecklist() {
    const tbody = document.getElementById('tablaChecklist');
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#999; padding: 2rem;">Cargando checklist...</td></tr>`;
    try {
        const { data, error } = await supabaseClient.schema('piscis').from('checklist_evento')
            .select('*').eq('evento_id', eventoActualId).order('prioridad', { ascending: true });
        if (error) throw error;
        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#999;">No hay tareas en el checklist.</td></tr>`;
            return;
        }
        data.forEach(item => {
            let fechaFmt = '-';
            if (item.fecha_limite) {
                const p = item.fecha_limite.split('-');
                if (p.length === 3) fechaFmt = `${p[2]}/${p[1]}/${p[0]}`;
            }
            const claseTachado = item.completado ? 'text-tachado' : '';
            const badgeColor = item.prioridad === 'alta' ? 'badge-pending' : (item.prioridad === 'baja' ? 'badge-success' : '');
            tbody.innerHTML += `
                <tr>
                    <td class="${claseTachado}">${item.tarea}</td>
                    <td><span class="badge ${badgeColor}">${item.prioridad.toUpperCase()}</span></td>
                    <td>${fechaFmt}</td>
                    <td><input type="checkbox" class="checkbox-custom" ${item.completado ? 'checked' : ''} onchange="toggleChecklist('${item.id}', this.checked)"></td>
                    <td>
                        <button class="btn-sm btn-delete" onclick="eliminarChecklist('${item.id}')">🗑️</button>
                    </td>
                </tr>`;
        });
    } catch (error) { tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Error al cargar.</td></tr>`; }
}

btnCerrarModalChecklist.addEventListener('click', () => modalChecklist.classList.add('hidden'));

formChecklist.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('checklistId').value;
    const tarea = sanitizarTexto(document.getElementById('inputTarea').value);
    const fecha_limite = document.getElementById('inputFechaLimite').value || null;
    const prioridad = document.getElementById('inputPrioridad').value;
    const btnGuardar = document.getElementById('btnGuardarChecklist');
    btnGuardar.innerText = 'Guardando...';
    btnGuardar.disabled = true;
    try {
        if (id) {
            const { error } = await supabaseClient.schema('piscis').from('checklist_evento').update({ tarea, fecha_limite, prioridad }).eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient.schema('piscis').from('checklist_evento').insert([{ evento_id: eventoActualId, tarea, fecha_limite, prioridad }]);
            if (error) throw error;
        }
        modalChecklist.classList.add('hidden');
        cargarChecklist();
    } catch (error) { alert("Error: " + error.message); }
    finally { btnGuardar.innerText = 'Guardar'; btnGuardar.disabled = false; }
});

window.toggleChecklist = async (id, completado) => {
    try {
        const { error } = await supabaseClient.schema('piscis').from('checklist_evento').update({ completado }).eq('id', id);
        if (error) throw error;
        cargarChecklist();
    } catch (error) { alert("Error al actualizar"); }
};

window.eliminarChecklist = async (id) => {
    if (!confirm('¿Eliminar esta tarea?')) return;
    try {
        const { error } = await supabaseClient.schema('piscis').from('checklist_evento').delete().eq('id', id);
        if (error) throw error;
        cargarChecklist();
    } catch (error) { alert("Error al eliminar"); }
};

// ==========================================
// 🚀 INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    cargarEventos();
    actualizarEstadisticas();
});