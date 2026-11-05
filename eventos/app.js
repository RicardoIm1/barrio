// 1. Configuración de Supabase (Tus credenciales)
const SUPABASE_URL = 'https://gnjaumpjerbbwlkcgxqa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduamF1bXBqZXJiYndsa2NneHFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MjQ5ODksImV4cCI6MjEwMzUwMDk4OX0.B6QRJN4gg1NuTmv-RyFBeWQaTmlFUoOYDZlkYaiFUjU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variable global para almacenar el ID del evento actual (en un caso real, esto vendría de la URL o de un select)
let eventoActualId = null; 

// Elementos del DOM
const tbody = document.getElementById('tablaInvitados');
const modal = document.getElementById('modalInvitado');
const form = document.getElementById('formInvitado');
const btnNuevo = document.getElementById('btnNuevoInvitado');
const btnCerrar = document.getElementById('btnCerrarModal');

// ==========================================
// READ: Cargar datos iniciales
// ==========================================
async function cargarDashboard() {
    // 1. Referenciamos la tabla y mostramos mensaje de carga inmediato
    const tbody = document.querySelector('#tablaInvitados');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#999; padding: 2rem;">Cargando invitados...</td></tr>`;
    }

    try {
        // A) Traer los eventos del esquema 'piscis'
        const { data: eventos, error: errEventos } = await supabaseClient
            .schema('piscis')
            .from('eventos')
            .select('*')
            .order('fecha_evento', { ascending: true });

        if (errEventos) throw errEventos;

        // B) Traer los invitados
        const { data: invitados, error: errInvitados } = await supabaseClient
            .schema('piscis')
            .from('invitados')
            .select('*');

        if (errInvitados) throw errInvitados;

        // 3. Actualizar las estadísticas de las tarjetas superiores
        document.querySelectorAll('.stat-number')[0].innerText = eventos.length; 
        document.querySelectorAll('.stat-number')[1].innerText = invitados.length; 

        // 4. Llenar la tabla de invitados
        if (!tbody) return; // Por seguridad, si no existe la tabla, paramos aquí

        tbody.innerHTML = ''; // Limpiamos el mensaje de carga

        invitados.forEach(inv => {
            // Formateamos el estado del pase para que se vea bonito
            let badgeClass = 'badge-pending';
            let badgeText = 'Pendiente';
            if (inv.estado_pase === 'guardado_en_wallet') {
                badgeClass = 'badge-success';
                badgeText = 'Guardado en Wallet';
            }

            // Creamos la fila
            const fila = `
                <tr>
                    <td>${inv.nombre}</td>
                    <td>${inv.whatsapp || 'Sin número'}</td>
                    <td><span class="badge ${badgeClass}">${badgeText}</span></td>
                    <td><button class="btn-sm" data-id="${inv.id}">Enviar Link</button></td>
                </tr>
            `;
            tbody.innerHTML += fila;
        });

        console.log("✅ Dashboard cargado con datos de Supabase");

    } catch (error) {
        console.error("❌ Error cargando datos:", error.message);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red; padding: 2rem;">Error al cargar los datos. Revisa la consola.</td></tr>`;
        }
        alert("Error al conectar con la base de datos. Revisa la consola.");
    }
}

function renderizarTabla(invitados) {
    tbody.innerHTML = ''; 
    invitados.forEach(inv => {
        let badgeClass = inv.estado_pase === 'guardado_en_wallet' ? 'badge-success' : 'badge-pending';
        let badgeText = inv.estado_pase === 'guardado_en_wallet' ? 'Guardado en Wallet' : 'Pendiente';

        const fila = `
            <tr>
                <td>${inv.nombre}</td>
                <td>${inv.whatsapp || 'Sin número'}</td>
                <td><span class="badge ${badgeClass}">${badgeText}</span></td>
                <td>
                    <button class="btn-sm btn-edit" onclick="abrirModalEditar('${inv.id}', '${inv.nombre}', '${inv.whatsapp || ''}')">Editar</button>
                    <button class="btn-sm btn-delete" onclick="eliminarInvitado('${inv.id}')">Borrar</button>
                </td>
            </tr>
        `;
        tbody.innerHTML += fila;
    });
}

// ==========================================
// MODAL: Abrir y Cerrar
// ==========================================
btnNuevo.addEventListener('click', () => {
    form.reset();
    document.getElementById('invitadoId').value = '';
    document.getElementById('modalTitulo').innerText = 'Nuevo Invitado';
    modal.classList.remove('hidden');
});

btnCerrar.addEventListener('click', () => {
    modal.classList.add('hidden');
});

// Función global para que funcione el onclick del HTML
window.abrirModalEditar = (id, nombre, whatsapp) => {
    document.getElementById('invitadoId').value = id;
    document.getElementById('inputNombre').value = nombre;
    document.getElementById('inputWhatsapp').value = whatsapp;
    document.getElementById('modalTitulo').innerText = 'Editar Invitado';
    modal.classList.remove('hidden');
};

// ==========================================
// CREATE & UPDATE: Guardar Formulario
// ==========================================
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('invitadoId').value;
    const nombre = document.getElementById('inputNombre').value;
    const whatsapp = document.getElementById('inputWhatsapp').value;

    const btnGuardar = document.getElementById('btnGuardar');
    btnGuardar.innerText = 'Guardando...';
    btnGuardar.disabled = true;

    try {
        if (id) {
            // UPDATE
            const { error } = await supabaseClient.schema('piscis').from('invitados')
                .update({ nombre, whatsapp }).eq('id', id);
            if (error) throw error;
        } else {
            // CREATE
            const { error } = await supabaseClient.schema('piscis').from('invitados')
                .insert([{ evento_id: eventoActualId, nombre, whatsapp, estado_pase: 'pendiente' }]);
            if (error) throw error;
        }
        
        modal.classList.add('hidden');
        cargarDashboard(); // Recargar tabla

    } catch (error) {
        console.error("Error guardando:", error.message);
        alert("Error al guardar: " + error.message);
    } finally {
        btnGuardar.innerText = 'Guardar';
        btnGuardar.disabled = false;
    }
});

// ==========================================
// DELETE: Eliminar Invitado
// ==========================================
window.eliminarInvitado = async (id) => {
    if (!confirm('¿Estás seguro de eliminar a este invitado?')) return;

    try {
        const { error } = await supabaseClient.schema('piscis').from('invitados')
            .delete().eq('id', id);
        if (error) throw error;
        
        cargarDashboard(); // Recargar tabla
    } catch (error) {
        console.error("Error eliminando:", error.message);
        alert("Error al eliminar: " + error.message);
    }
};

// Iniciar
document.addEventListener('DOMContentLoaded', cargarDashboard);