// Service worker for handling background push notifications natively.
// This works reliably with Firebase Cloud Messaging (FCM) Web Push payloads.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    
    // Parse notification attributes from FCM structure
    const title = payload.notification?.title || payload.data?.title || 'Orange Island Progress Tracker';
    const body = payload.notification?.body || payload.data?.body || 'Please update your progress in the app.';
    const icon = payload.notification?.icon || '/assets/orange-island-logo.png';
    const data = payload.data || {};

    const options = {
      body,
      icon,
      badge: '/assets/orange-island-logo.png',
      data,
      vibrate: [100, 50, 100],
    };

    const badgePromise = ('setAppBadge' in navigator)
      ? navigator.setAppBadge(1).catch((err) => console.error('Failed to set app badge in background:', err))
      : Promise.resolve();

    event.waitUntil(
      Promise.all([
        self.registration.showNotification(title, options),
        badgePromise
      ])
    );
  } catch (error) {
    console.error('Error parsing push event data:', error);
    const badgePromise = ('setAppBadge' in navigator)
      ? navigator.setAppBadge(1).catch(() => undefined)
      : Promise.resolve();
    // Fallback if the payload is text or fails to parse as JSON
    event.waitUntil(
      Promise.all([
        self.registration.showNotification('Orange Island Progress Tracker', {
          body: event.data.text() || 'Please check the tracker for updates.',
          icon: '/assets/orange-island-logo.png',
        }),
        badgePromise
      ])
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Open the app window or focus it if already open
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
      return null;
    })
  );
});
