import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';

const browser = process.env.LAB_BROWSER;
const user = process.env.LAB_USER;
const runId = process.env.LAB_RUN_ID;
if (browser !== 'chrome' && browser !== 'msedge') throw new Error('LAB_BROWSER must be chrome or msedge');
if (!user || !/^[a-z0-9-]+$/.test(user)) throw new Error('LAB_USER must be a selected seed user');
if (!runId || !/^[a-zA-Z0-9_-]+$/.test(runId)) throw new Error('LAB_RUN_ID is required');
const artifacts = resolve(import.meta.dirname, '../artifacts/playwright', runId);
const cert = { certPath: '/identity/cert.pem', keyPath: '/identity/key.pem' };

export default defineConfig({
  testDir: './playwright',
  testMatch: 'recorded-ui.spec.ts',
  outputDir: resolve(artifacts, 'test-results'),
  timeout: 45_000,
  expect: { timeout: 12_000 },
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: resolve(artifacts, 'html'), open: 'never' }],
    ['junit', { outputFile: resolve(artifacts, 'junit.xml') }]
  ],
  use: {
    browserName: 'chromium',
    channel: browser,
    headless: true,
    ignoreHTTPSErrors: false,
    clientCertificates: [
      { origin: 'https://shop.magic.test:8443', ...cert },
      { origin: 'https://auth.magic.test:9443', ...cert }
    ],
    video: 'on',
    screenshot: 'only-on-failure',
    trace: 'off'
  }
});
