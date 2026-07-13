import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app } from './firebase';

export async function isPushSupported() {
  if (typeof window === 'undefined') return false;
  return await isSupported();
}

export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  return permission;
}

export async function subscribeToPushNotifications() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return null;
  }

  const messaging = getMessaging(app);
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
  const token = await getToken(messaging, vapidKey ? { vapidKey } : undefined);
  return token || null;
}

export function onForegroundMessage(callback: (payload: any) => void) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
    return () => {};
  }

  const messaging = getMessaging(app);
  return onMessage(messaging, callback);
}
