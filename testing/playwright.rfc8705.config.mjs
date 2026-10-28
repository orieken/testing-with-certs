import { defineConfig } from '@playwright/test';
const channel = process.env.LAB_BROWSER;
if (!['chrome', 'msedge'].includes(channel)) throw new Error('Select real Chrome or Edge');
export default defineConfig({
  testDir: 'rfc8705', testMatch: '*.spec.mjs', timeout: 60000, workers: 1, retries: 0,
  reporter: [['./reporting/rfc8705.mjs']], outputDir: '/home/runner/rfc8705-results',
  use: { channel, headless: false, launchOptions: { args: ['--no-sandbox'] },
    ignoreHTTPSErrors: false, trace: 'off', screenshot: 'off', video: 'off' },
});
