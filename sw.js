// sw.js - Service Worker para notificaciones push
self.addEventListener('push', function(event) {
    let data = {};
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = { title: 'Nueva notificación', body: event.data.text() };
        }
    }
    
    const options = {
        body: data.body || 'Tienes una nueva notificación en BARRIO',
        icon: '/barrio/icon.png',
        badge: '/barrio/badge.png',
        vibrate: [200, 100, 200],
        data: {
            url: data.url || '/barrio/index.html'
        }
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'BARRIO', options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    const urlToOpen = event.notification.data?.url || '/barrio/index.html';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                for (let client of windowClients) {
                    if (client.url.includes(urlToOpen) && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});