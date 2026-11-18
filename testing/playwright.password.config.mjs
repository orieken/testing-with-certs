import { defineConfig } from '@playwright/test';
const channel = process.env.LAB_BROWSER;
if (!['chrome', 'msedge'].includes(channel)) throw new Error('Real Chrome or Edge required');
export default defineConfig({ testDir: './playwright', testMatch: 'certificate-password.spec.mjs',
  outputDir: '/tmp/password-results', timeout: 90_000, workers: 1, retries: 0,
  reporter: [
    ['./reporting/password-playwright.mjs'],
    ...(process.env.SATURDAY_REPORT_DIR ? [['@orieken/saturday-playwright-reporter', {
      outputDir: process.env.SATURDAY_REPORT_DIR,
      title: 'Certificate and password pilot',
      includeSteps: false,
      artifactRoots: ['/work/artifacts/certificate-password-ci'],
      metadata: { browser: channel, auth: 'certificate-password' },
    }]] : []),
  ],
  use: { channel, headless: true, ignoreHTTPSErrors: false, launchOptions: { args: ['--disable-http2'] },
    trace: 'off', screenshot: 'off', video: 'off' },
});
