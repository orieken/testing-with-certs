import { createApp } from 'vue';
import TeachingApp from './TeachingApp.vue';
import { initializeTeaching } from './session';

export async function mountTeaching(): Promise<void> {
  await initializeTeaching();
  createApp(TeachingApp).mount('#app');
}
