// ============================================================
// FILE: apps/web/public/sw-notifications.js
// Service Worker for Push Notifications
// ============================================================

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'New Notification', body: '', icon: '/favicon.ico', actionUrl: '/' };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    // If not JSON, use text
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.tag || 'default',
    renotify: true,
    data: {
      actionUrl: data.actionUrl || '/',
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const actionUrl = event.notification.data?.actionUrl || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if available
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(actionUrl);
          return client.focus();
        }
      }
      // Otherwise open new window
      return clients.openWindow(actionUrl);
    })
  );
});