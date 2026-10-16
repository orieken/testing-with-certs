import { createApp } from 'vue';
import LessonsApp from './LessonsApp.vue';
import { initializeLesson, activeLesson } from './session';

export async function mountCertificateFree(): Promise<void> {
  if (activeLesson) await initializeLesson();
  createApp(LessonsApp).mount('#app');
}
