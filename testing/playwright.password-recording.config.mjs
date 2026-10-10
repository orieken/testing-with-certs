import { defineConfig } from '@playwright/test';
const channel = process.env.LAB_BROWSER;
if (!['chrome', 'msedge'].includes(channel)) throw new Error('Real Chrome or Edge required');
export default defineConfig({ testDir: './playwright', testMatch: 'certificate-password-recording.spec.mjs',
  outputDir: '/tmp/password-recording-results', timeout: 90_000, workers: 1, retries: 0, reporter: 'list',
  use: { channel, headless: true, ignoreHTTPSErrors: false,
    launchOptions: { args: ['--disable-http2'], slowMo: 450 },
    trace: 'off', screenshot: 'off', video: 'off' },
});
