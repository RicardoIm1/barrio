// service-worker.js
self.addEventListener('push', function(event) {
  const datos = event.data.json();
  
  const opciones = {
    body: datos.descripcion,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: datos.url,
      id: datos.id
    },
    actions: [
      { action: 'ver', title: '👀 Ver aviso' },
      { action: 'ignorar', title: '⏰ Después' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(datos.titulo, opciones)
  );
});

// Manejar clic en notificación
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  if (event.action === 'ver') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});