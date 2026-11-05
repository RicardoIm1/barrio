// ==========================================
// 1. Configuración de Supabase
// ==========================================
const SUPABASE_URL = 'https://gnjaumpjerbbwlkcgxqa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduamF1bXBqZXJiYndsa2NneHFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MjQ5ODksImV4cCI6MjEwMzUwMDk4OX0.B6QRJN4gg1NuTmv-RyFBeWQaTmlFUoOYDZlkYaiFUjU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variable global para almacenar el ID del evento actual
let eventoActualId = null; 

// Elementos del DOM
const modal = document.getElementById('modalInvitado');
const form = document.getElementById('formInvitado');
const btnNuevo = document.getElementById('btnNuevoInvitado');
const btnCerrar = document.getElementById('btnCerrarModal');

// ==========================================
// 2. READ: Cargar datos iniciales (Dashboard)
// ==========================================
async function cargarDashboard() {
    const tbody = document.querySelector('#tablaInvitados');
    
    // Mostrar mensaje de carga
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#999; padding: 2rem;">Cargando datos...</td></tr>`;
    }

    try {
        // A) Traer los eventos del esquema 'piscis'
        const { data: eventos, error: errEventos } = await supabaseClient
            .schema('piscis')
            .from('eventos')
            .select('*')
            .order('fecha_evento', { ascending: true });

        if (errEventos) throw errEventos;

        // 🔥 ASIGNAR EL ID DEL EVENTO ACTUAL (Para que el formulario de invitados funcione)
        if (eventos && eventos.length > 0) {
            eventoActualId = eventos[0].id;
            // Actualizamos el título de la sección con el nombre del evento real
            const headerTitle = document.querySelector('.table-header h3');
            if (headerTitle) headerTitle.innerText = `Invitados (${eventos[0].nombre_evento})`;
        }

        // B) Traer los invitados (filtrados por el evento actual)
        let query = supabaseClient.schema('piscis').from('invitados').select('*');
        if (eventoActualId) {
            query = query.eq('evento_id', eventoActualId);
        }
        const { data: invitados, error: errInvitados } = await query;
        if (errInvitados) throw errInvitados;

        // C) Actualizar las estadísticas de las tarjetas superiores
        const statNumbers = document.querySelectorAll('.stat-number');
        if (statNumbers.length >= 2) {
            statNumbers[0].innerText = eventos.length; 
            statNumbers[1].innerText = invitados.length; 
        }

        // D) Llenar la tabla de invitados
        if (!tbody) return;
        tbody.innerHTML = ''; // Limpiamos el mensaje de carga

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

        console.log("✅ Dashboard cargado. Evento actual:", eventoActualId);

    } catch (error) {
        console.error("❌ Error cargando datos:", error.message);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red; padding: 2rem;">Error al cargar los datos.</td></tr>`;
        }
    }
}

// ==========================================
// 3. MODAL: Abrir y Cerrar
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

// Función global para el botón "Editar" de la tabla
window.abrirModalEditar = (id, nombre, whatsapp) => {
    document.getElementById('invitadoId').value = id;
    document.getElementById('inputNombre').value = nombre;
    document.getElementById('inputWhatsapp').value = whatsapp;
    document.getElementById('modalTitulo').innerText = 'Editar Invitado';
    modal.classList.remove('hidden');
};

// ==========================================
// 4. CREATE & UPDATE: Guardar Formulario
// ==========================================
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // 🔥 VALIDACIÓN CLAVE: Evitar error si no hay evento cargado
    if (!eventoActualId) {
        alert("Error: No hay un evento seleccionado en el sistema. Recarga la página.");
        return;
    }

    const id = document.getElementById('invitadoId').value;
    const nombre = document.getElementById('inputNombre').value;
    const whatsapp = document.getElementById('inputWhatsapp').value;

    const btnGuardar = document.getElementById('btnGuardar');
    btnGuardar.innerText = 'Guardando...';
    btnGuardar.disabled = true;

    try {
        if (id) {
            // UPDATE (Actualizar)
            const { error } = await supabaseClient.schema('piscis').from('invitados')
                .update({ nombre, whatsapp }).eq('id', id);
            if (error) throw error;
            console.log("✅ Invitado actualizado");
        } else {
            // CREATE (Crear nuevo)
            const { error } = await supabaseClient.schema('piscis').from('invitados')
                .insert([{ 
                    evento_id: eventoActualId, 
                    nombre: nombre, 
                    whatsapp: whatsapp, 
                    estado_pase: 'pendiente' 
                }]);
            if (error) throw error;
            console.log("✅ Invitado creado");
        }
        
        modal.classList.add('hidden');
        cargarDashboard(); // Recargar tabla con los datos frescos

    } catch (error) {
        console.error("Error guardando:", error.message);
        alert("Error al guardar: " + error.message);
    } finally {
        btnGuardar.innerText = 'Guardar';
        btnGuardar.disabled = false;
    }
});

// ==========================================
// 5. DELETE: Eliminar Invitado
// ==========================================
window.eliminarInvitado = async (id) => {
    if (!confirm('¿Estás seguro de eliminar a este invitado?')) return;

    try {
        const { error } = await supabaseClient.schema('piscis').from('invitados')
            .delete().eq('id', id);
        if (error) throw error;
        
        console.log("✅ Invitado eliminado");
        cargarDashboard(); // Recargar tabla
    } catch (error) {
        console.error("Error eliminando:", error.message);
        alert("Error al eliminar: " + error.message);
    }
};

// ==========================================
// 6. INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', cargarDashboard);