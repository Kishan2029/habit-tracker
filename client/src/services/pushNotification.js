import api from '../api/axios.js';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Waits for SW to be ready and active, gives up after `ms` milliseconds
async function swReady(ms = 8000) {
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('Service worker not ready — try refreshing the page')),
        ms
      )
    ),
  ]);

  // If SW is already active, return immediately
  if (registration.active) return registration;

  // Otherwise wait for it to become active
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Service worker not ready — try refreshing the page')),
      ms
    );
    const sw = registration.installing || registration.waiting;
    if (!sw) {
      clearTimeout(timeout);
      return resolve(registration);
    }
    sw.addEventListener('statechange', function handler(e) {
      if (e.target.state === 'activated') {
        clearTimeout(timeout);
        sw.removeEventListener('statechange', handler);
        resolve(registration);
      } else if (e.target.state === 'redundant') {
        clearTimeout(timeout);
        sw.removeEventListener('statechange', handler);
        reject(new Error('Service worker failed — try refreshing the page'));
      }
    });
  });
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY;
}

export async function subscribeToPush() {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission denied');
  }

  const registration = await swReady();
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  await api.post('/push/subscribe', { subscription: subscription.toJSON() });
  return subscription;
}

export async function unsubscribeFromPush() {
  const registration = await swReady();
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
    await api.delete('/push/unsubscribe');
  }
}

export async function isSubscribed() {
  if (!isPushSupported()) return false;
  try {
    const registration = await swReady();
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}
