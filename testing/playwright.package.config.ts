import { defineConfig } from '@playwright/test';

const channel = process.env.LAB_BROWSER;
if (channel !== 'chrome' && channel !== 'msedge') throw new Error('Real Chrome or Edge required');
export default defineConfig({
  testDir: './playwright', testMatch: 'package-adapter.spec.ts',
  outputDir: '/home/runner/package-test-results',
  workers: 1, retries: 0, timeout: 35_000, expect: { timeout: 15_000 },
  reporter: [['list']], use: { browserName: 'chromium', channel, ignoreHTTPSErrors: false, trace: 'off' }
});
