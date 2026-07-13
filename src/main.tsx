import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('Service worker registered for Firebase Messaging.');
    } catch (error) {
      console.warn('Service worker registration failed:', error);
    }
  });
}
