document.addEventListener('DOMContentLoaded', () => {
    console.log("🎨 Piscis Digital iniciado correctamente.");

    // 1. Simulamos que estamos obteniendo la lista de invitados de Supabase
    const invitados = [
        { id: '1', nombre: 'Regina Treviño', whatsapp: '+52 55 1234 5678', estado: 'guardado' },
        { id: '2', nombre: 'Carlos Mendoza', whatsapp: '+52 55 8765 4321', estado: 'pendiente' },
    ];

    const { data } = await supabase
        .schema('piscis')
        .from('planning_evento')
        .select('*')
        .eq('evento_id', eventoId)
        .order('hora_inicio', { ascending: true });

    // 2. Seleccionamos todos los botones de la tabla
    const botonesEnviar = document.querySelectorAll('.btn-sm');

    botonesEnviar.forEach(boton => {
        boton.addEventListener('click', (e) => {
            // Encontramos la fila del botón que se picó
            const fila = e.target.closest('tr');
            const nombreInvitado = fila.querySelector('td').innerText;
            const numeroWA = fila.querySelectorAll('td')[1].innerText;

            // 3. Aquí conectaremos con Supabase después:
            // - Llamar a la Edge Function para generar el link de Google Wallet.
            // - Generar el link de wa.me con el pase.
            // - Abrir WhatsApp o enviar por API.

            console.log(`Generando pase para ${nombreInvitado}...`);
            
            // Simulación visual para que veas que funciona
            const badge = fila.querySelector('.badge');
            badge.innerText = "Generando...";
            badge.className = "badge badge-pending";

            setTimeout(() => {
                badge.innerText = "Guardado en Wallet";
                badge.className = "badge badge-success";
                boton.innerText = "Reenviar Link";
                
                // Simulamos la apertura de WhatsApp
                // const linkWhatsApp = `https://wa.me/${numeroWA.replace(/\s/g, '')}?text=Hola%20${nombreInvitado},%20aquí%20está%20tu%20pase%20para%20la%20boda...`;
                // window.open(linkWhatsApp, '_blank'); 
            }, 1500);
        });
    });
});