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
  console.log('[SW Push] Event received');
  console.log('[SW Push] Has data:', !!event.data);

  let data = { title: 'Habit Tracker', body: 'You have a new notification.' };

  if (event.data) {
    try {
      data = event.data.json();
      console.log('[SW Push] Parsed payload:', JSON.stringify(data));
    } catch (e) {
      data.body = event.data.text();
      console.warn('[SW Push] Failed to parse JSON, using text:', data.body);
    }
  } else {
    console.warn('[SW Push] No data in push event, using defaults');
  }

  // Use data.data.url if the payload nests url inside a data object
  const clickUrl = data.data?.url || data.url || '/';

  // Milestone and streak notifications should persist until dismissed
  const interactiveTags = ['streak-', 'weekly-summary'];
  const shouldRequireInteraction = interactiveTags.some((t) => (data.tag || '').startsWith(t));

  const options = {
    body: data.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: data.tag || 'habit-tracker',
    data: { url: clickUrl },
    requireInteraction: shouldRequireInteraction,
  };

  console.log('[SW Push] Showing notification:', data.title, options);

  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .then(() => console.log('[SW Push] showNotification resolved successfully'))
      .catch((err) => console.error('[SW Push] showNotification failed:', err))
  );
});

// ─── Notification Click ────────────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  console.log('[SW Click] Notification clicked:', event.notification.tag);
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
