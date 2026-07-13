importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js');

const firebaseConfig = {
  projectId: 'gen-lang-client-0436225283',
  appId: '1:3960761774:web:5e4a276e995304e3df6c3f',
  apiKey: 'AIzaSyBI2x9grLH5qjzCgOXepKHxiFM2flXLXj8',
  authDomain: 'gen-lang-client-0436225283.firebaseapp.com',
  storageBucket: 'gen-lang-client-0436225283.firebasestorage.app',
  messagingSenderId: '3960761774',
  measurementId: '',
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || 'Orange Island Progress Tracker';
  const notificationOptions = {
    body: payload.notification?.body || 'Please update your progress in the app.',
    icon: '/assets/orange-island-logo.png',
    data: payload.data,
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
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
