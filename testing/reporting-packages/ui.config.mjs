import { defineConfig } from '../../packages/saturday-playwright-reporter/node_modules/@playwright/test/index.mjs';
import { fileURLToPath } from 'node:url';
const output = fileURLToPath(new URL('../../artifacts/saturday-reporting/', import.meta.url));
export default defineConfig({
  testDir: '.', testMatch: 'ui.spec.mjs', workers: 1, retries: 0, timeout: 20000,
  updateSnapshots: 'none',
  outputDir: `${output}/ui-results`,
  snapshotPathTemplate: '{testDir}/ui-snapshots/{projectName}/{arg}{ext}',
  reporter: [['list'], ['json', { outputFile: `${output}/ui-results.json` }]],
  expect: { toHaveScreenshot: { animations: 'disabled', maxDiffPixels: 0 } },
  use: { browserName: 'chromium', headless: true, locale: 'en-US', timezoneId: 'UTC', colorScheme: 'dark',
    ...(process.env.SATURDAY_BROWSER_CHANNEL ? { channel: process.env.SATURDAY_BROWSER_CHANNEL } : {}) },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 960 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
});
