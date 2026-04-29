// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyD6TBV8AmQwxAIoQJB5yuxrKcqAEVOWYKQ",
  authDomain: "avisos-jardines.firebaseapp.com",
  projectId: "avisos-jardines",
  storageBucket: "avisos-jardines.firebasestorage.app",
  messagingSenderId: "1010324110751",
  appId: "1:1010324110751:web:c7ab30ffadfb5966fd51aa"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Manejar notificaciones en segundo plano
messaging.onBackgroundMessage((payload) => {
  console.log('[Service Worker] Notificación en segundo plano:', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon.png', // Puedes usar un emoji o crear un icono
    badge: '/badge.png',
    data: payload.data,
    vibrate: [200, 100, 200],
    requireInteraction: true // La notificación persiste hasta que el usuario interactúe
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Manejar clicks en notificaciones
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Si ya hay una ventana abierta, la enfoca
        for (let client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Si no, abre una nueva
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});