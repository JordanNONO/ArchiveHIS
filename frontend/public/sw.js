/**
 * Service worker minimal — sert uniquement à afficher les notifications
 * système (Web Push) envoyées par le backend (voir WebPushChannel.php),
 * même onglet/navigateur fermé. Pas de mise en cache/mode hors-ligne : ce
 * n'est pas l'objectif ici, juste les notifications.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = { title: 'HIS Archivage', body: '', url: '/' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // ignore payload non-JSON, garde les valeurs par défaut
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/logo192.png',
      badge: '/logo192.png',
      data: { url: payload.url || '/' },
    })
  );
});

// Un clic focalise un onglet HIS Archivage déjà ouvert plutôt que d'en
// ouvrir un nouveau à chaque fois, et le fait naviguer vers le document
// concerné — sinon on se retrouve avec un onglet par notification cliquée.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
