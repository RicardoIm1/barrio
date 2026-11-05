// 1. Configura tu cliente de Supabase (Pon tus credenciales reales)
const SUPABASE_URL = 'https://gnjaumpjerbbwlkcgxqa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_x01F_xzyh5b-sZdwhKh6FQ_OzQVxMpN';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. Función para cargar los datos reales en la interfaz
async function cargarDashboard() {
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
        const tbody = document.querySelector('tbody');
        tbody.innerHTML = ''; // Limpiamos los datos falsos

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
        alert("Error al conectar con la base de datos. Revisa la consola.");
    }
}

// 3. Ejecutar cuando la página cargue
document.addEventListener('DOMContentLoaded', cargarDashboard);