// To fix typescript complaints about Service Worker scope
/// <reference lib="webworker" />
export type { };
declare const self: ServiceWorkerGlobalScope;

// Take control immediately
self.addEventListener('install', () => {
  console.log('[SW] Installing new service worker...');
  self.skipWaiting(); // Force the waiting service worker to become the active service worker
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(self.clients.claim()); // Take control of all open clients immediately
});

// Listen to push events
self.addEventListener('push', (event: PushEvent) => {
  console.log('[SW] Push event received', event);
  if (!event.data) {
    console.warn('[SW] Push event received but had no data');
    return;
  }

  try {
    const data = event.data.json();
    console.log('[SW] Push data parsed:', data);

    const options = {
      body: data.body || '',
      icon: data.icon || '/icons/icon-192x192.png',
      badge: data.badge || '/icons/badge-72x72.png',
      vibrate: [200, 100, 200, 100, 200],
      tag: 'push-notification-tag',
      renotify: true,
      silent: false,
      timestamp: Date.now(),
      data: {
        url: data.url || '/',
      },
    };

    event.waitUntil(
      Promise.all([
        self.registration.showNotification(data.title || 'New Notification', options as any),
        // Set the app badge on the home screen icon if supported (use self.navigator for SW scope)
        'setAppBadge' in self.navigator ? (self.navigator as any).setAppBadge(1) : Promise.resolve()
      ])
    );
  } catch (err) {
    console.error('[SW] Error handling push event', err);
    // fallback if payload is not JSON
    event.waitUntil(
      self.registration.showNotification('New Notification', {
        body: event.data.text() || '',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: 'push-notification-tag',
        renotify: true,
      } as any)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  // Clear app badge when notification is clicked
  if ('clearAppBadge' in navigator) {
    (navigator as any).clearAppBadge();
  }

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window client is already open, focus it and navigate
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

// Clear app badge when the notification is closed without clicking
self.addEventListener('notificationclose', (event) => {

  if ('clearAppBadge' in navigator) {
    (navigator as any).clearAppBadge();
  }
});

