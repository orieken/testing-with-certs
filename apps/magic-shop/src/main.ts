import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { initializeAuth } from './auth/session';
import './styles.css';
import 'leaflet/dist/leaflet.css';

await initializeAuth();
const { default: router } = await import('./router');
const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
