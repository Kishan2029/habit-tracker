// vite-plugin-pwa needs this line to inject the precache manifest
// eslint-disable-next-line no-undef
const manifest = self.__WB_MANIFEST || [];

// Basic precaching without workbox imports
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open('habit-tracker-v1').then((cache) => {
      // Precache manifest assets in production
      const urls = manifest.map((entry) =>
        typeof entry === 'string' ? entry : entry.url
      );
      return urls.length ? cache.addAll(urls).catch((err) => {
        console.warn('[SW] Precache failed for some assets:', err);
      }) : Promise.resolve();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// ─── Push Notifications ────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let data = { title: 'Habit Tracker', body: 'You have a new notification.' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: data.tag || 'habit-tracker',
    data: { url: data.url || '/' },
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ─── Notification Click ────────────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
