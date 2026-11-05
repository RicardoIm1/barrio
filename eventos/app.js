// ==========================================
// 1. Configuración de Supabase
// ==========================================
const SUPABASE_URL = 'https://gnjaumpjerbbwlkcgxqa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduamF1bXBqZXJiYndsa2NneHFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MjQ5ODksImV4cCI6MjEwMzUwMDk4OX0.B6QRJN4gg1NuTmv-RyFBeWQaTmlFUoOYDZlkYaiFUjU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let eventoActualId = null; 

// Elementos del DOM
const modal = document.getElementById('modalInvitado');
const form = document.getElementById('formInvitado');
const btnNuevo = document.getElementById('btnNuevoInvitado');
const btnCerrar = document.getElementById('btnCerrarModal');
const inputWhatsapp = document.getElementById('inputWhatsapp');

// ==========================================
// 🛡️ FUNCIONES DE SANITIZACIÓN Y MÁSCARA
// ==========================================
function sanitizarTexto(texto) {
    if (!texto) return '';
    const sinHTML = texto.replace(/<[^>]*>?/gm, '');
    return sinHTML.trim().replace(/\s+/g, ' ');
}

function formatearTelefonoVisual(valor) {
    let numeros = valor.replace(/\D/g, '');
    if (!numeros.startsWith('52')) {
        numeros = '52' + numeros;
    }
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
// 2. READ: Cargar datos iniciales
// ==========================================
async function cargarDashboard() {
    const tbody = document.querySelector('#tablaInvitados');
    if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#999; padding: 2rem;">Cargando datos...</td></tr>`;

    try {
        const { data: eventos, error: errEventos } = await supabaseClient
            .schema('piscis').from('eventos').select('*').order('fecha_evento', { ascending: true });
        if (errEventos) throw errEventos;

        if (eventos && eventos.length > 0) {
            eventoActualId = eventos[0].id;
            const headerTitle = document.querySelector('.table-header h3');
            if (headerTitle) headerTitle.innerText = `Invitados (${eventos[0].nombre_evento})`;
        }

        let query = supabaseClient.schema('piscis').from('invitados').select('*');
        if (eventoActualId) query = query.eq('evento_id', eventoActualId);
        
        const { data: invitados, error: errInvitados } = await query;
        if (errInvitados) throw errInvitados;

        const statNumbers = document.querySelectorAll('.stat-number');
        if (statNumbers.length >= 2) {
            statNumbers[0].innerText = eventos.length; 
            statNumbers[1].innerText = invitados.length; 
        }

        if (!tbody) return;
        tbody.innerHTML = '';

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
                        <button class="btn-sm btn-edit" onclick="abrirModalEditar('${inv.id}', '${inv.nombre}', '${inv.whatsapp || ''}')">Editar</button>
                        <button class="btn-sm btn-delete" onclick="eliminarInvitado('${inv.id}')">Borrar</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += fila;
        });

    } catch (error) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Error al cargar.</td></tr>`;
    }
}

// ==========================================
// 3. MODAL: Abrir y Cerrar
// ==========================================
btnNuevo.addEventListener('click', () => {
    form.reset();
    document.getElementById('invitadoId').value = '';
    document.getElementById('modalTitulo').innerText = 'Nuevo Invitado';
    inputWhatsapp.value = '+52 '; 
    modal.classList.remove('hidden');
});

btnCerrar.addEventListener('click', () => modal.classList.add('hidden'));

window.abrirModalEditar = (id, nombre, whatsapp) => {
    document.getElementById('invitadoId').value = id;
    document.getElementById('inputNombre').value = nombre;
    inputWhatsapp.value = whatsapp ? formatearTelefonoVisual(whatsapp) : '+52 ';
    document.getElementById('modalTitulo').innerText = 'Editar Invitado';
    modal.classList.remove('hidden');
};

// ==========================================
// 4. CREATE & UPDATE: Guardar Formulario
// ==========================================
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!eventoActualId) {
        alert("Error: No hay un evento seleccionado. Recarga la página.");
        return;
    }

    const id = document.getElementById('invitadoId').value;
    const nombreLimpio = sanitizarTexto(document.getElementById('inputNombre').value);
    const whatsappLimpio = inputWhatsapp.value.replace(/\D/g, '');

    if (whatsappLimpio.length > 2 && whatsappLimpio.length < 12) {
        alert("Por favor, ingresa un número de WhatsApp válido (10 dígitos).");
        return;
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
                .insert([{ 
                    evento_id: eventoActualId, 
                    nombre: nombreLimpio, 
                    whatsapp: whatsappLimpio, 
                    estado_pase: 'pendiente' 
                }]);
            if (error) throw error;
        }
        
        modal.classList.add('hidden');
        cargarDashboard(); 

    } catch (error) {
        alert("Error al guardar: " + error.message);
    } finally {
        btnGuardar.innerText = 'Guardar';
        btnGuardar.disabled = false;
    }
});

// ==========================================
// 5. DELETE
// ==========================================
window.eliminarInvitado = async (id) => {
    if (!confirm('¿Estás seguro de eliminar a este invitado?')) return;
    try {
        const { error } = await supabaseClient.schema('piscis').from('invitados').delete().eq('id', id);
        if (error) throw error;
        cargarDashboard();
    } catch (error) {
        alert("Error al eliminar: " + error.message);
    }
};

// Iniciar
document.addEventListener('DOMContentLoaded', cargarDashboard);