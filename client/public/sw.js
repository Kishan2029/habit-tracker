self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));

// ─── Push Notifications ───────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let data = { title: 'Habit Tracker', body: 'You have a new notification.' };
  if (event.data) {
    try { data = event.data.json(); }
    catch { data.body = event.data.text(); }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: data.tag || 'habit-tracker',
      data: { url: data.url || '/' },
    })
  );
});

// ─── Notification Click ───────────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return clients.openWindow?.(url);
    })
  );
});
