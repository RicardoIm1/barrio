// ============================================================
// EL BARRIO · Service Worker para Web Push
// Sin Firebase
// ============================================================

self.addEventListener('push', function (event) {
  event.waitUntil((async () => {
    let datos = {};

    try {
      datos = event.data ? event.data.json() : {};
    } catch (_) {
      try {
        datos = { descripcion: event.data ? event.data.text() : '' };
      } catch (_) {
        datos = {};
      }
    }

    const titulo = datos.titulo || 'El Barrio';
    const opciones = {
      body: datos.descripcion || datos.mensaje || 'Tienes una nueva notificación',
      icon: datos.icono || '/icons/logo-elbarrio.png',
      badge: datos.badge || '/icons/logo-elbarrio.png',
      vibrate: [200, 100, 200],
      tag: datos.tag || `el-barrio-${datos.id || Date.now()}`,
      renotify: true,
      data: {
        url: datos.url || (datos.aviso_id ? `/aviso.html?id=${datos.aviso_id}` : '/index.html'),
        id: datos.id || null,
        aviso_id: datos.aviso_id || null,
        tipo: datos.tipo || null,
      },
      actions: [
        { action: 'ver', title: 'Ver aviso' },
        { action: 'ignorar', title: 'Después' },
      ],
    };

    await self.registration.showNotification(titulo, opciones);
  })());
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  if (event.action === 'ignorar') return;

  event.waitUntil((async () => {
    const destino = event.notification.data?.url || '/index.html';
    const ventanas = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    for (const ventana of ventanas) {
      try {
        const actual = new URL(ventana.location.href);
        const objetivo = new URL(destino, self.location.origin);

        if (actual.href === objetivo.href || actual.pathname === objetivo.pathname) {
          await ventana.focus();
          return;
        }
      } catch (_) {}
    }

    if (clients.openWindow) {
      await clients.openWindow(destino);
    }
  })());
});

self.addEventListener('notificationclose', function () {
  // Reservado para telemetría futura. No se envían datos actualmente.
});
