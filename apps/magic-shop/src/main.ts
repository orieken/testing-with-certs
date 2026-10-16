import { createApp } from 'vue';
import { createPinia } from 'pinia';
import './styles.css';
import 'leaflet/dist/leaflet.css';

if (window.location.origin === 'https://shop.magic.test:8543') {
  const { mountCertificateFree } = await import('./teaching/certificate-free/mount');
  await mountCertificateFree();
} else if (['/teaching/certificate-password', '/teaching/certificate-password/callback'].includes(window.location.pathname)) {
  const { mountTeaching } = await import('./teaching/mount');
  await mountTeaching();
} else {
  const { initializeAuth } = await import('./auth/session');
  const { default: App } = await import('./App.vue');
  await initializeAuth();
  const { default: router } = await import('./router');
  const app = createApp(App);
  app.use(createPinia());
  app.use(router);
  app.mount('#app');
}
