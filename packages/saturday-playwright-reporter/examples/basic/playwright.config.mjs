import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', fullyParallel: true, workers: 2, retries: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/baseline.json' }],
    ['@orieken/saturday-playwright-reporter', { outputDir: 'saturday-report', runId: 'example', metadata: { team: 'examples' } }],
  ],
  use: { headless: true, ...(process.env.SATURDAY_BROWSER_CHANNEL ? { channel: process.env.SATURDAY_BROWSER_CHANNEL } : {}) },
});
