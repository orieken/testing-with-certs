import { defineConfig } from '@playwright/test';
const channel = process.env.LAB_BROWSER;
if (!['chrome', 'msedge'].includes(channel)) throw new Error('Real Chrome or Edge required');
export default defineConfig({ testDir: './playwright',
  testMatch: process.env.LAB_AUTH_SUITE === 'kerberos' ? 'kerberos.spec.mjs' : process.env.LAB_AUTH_SUITE === 'passkeys-lifecycle' ? 'passkeys-session.spec.mjs' : process.env.LAB_AUTH_SUITE === 'oidc-lifecycle' ? 'oidc-session.spec.mjs' : 'auth-lessons.spec.mjs',
  outputDir: '/tmp/auth-lesson-results', timeout: 90_000, workers: 1, retries: 0,
  reporter: './reporting/auth-lessons.mjs',
  use: { channel, headless: true, ignoreHTTPSErrors: false,
    launchOptions: { args: ['--disable-http2'] }, trace: 'off', screenshot: 'off', video: 'off' },
});
