import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';

const channel = process.env.LAB_BROWSER;
const runId = process.env.LAB_RUN_ID;
const runnerOS = process.env.LAB_RUNNER_OS ?? 'debian';
if (!['debian', 'ubi9'].includes(runnerOS)) throw new Error('LAB_RUNNER_OS must be debian or ubi9');
const requestedWorkers = process.env.LAB_TEST_WORKERS ?? '1';
if (channel !== 'chrome' && channel !== 'msedge') throw new Error('Real Chrome or Edge required');
if (!runId || !/^[a-zA-Z0-9_-]+$/.test(runId)) throw new Error('LAB_RUN_ID required');
if (!/^[1-4]$/.test(requestedWorkers)) throw new Error('LAB_TEST_WORKERS must be 1–4');
const artifacts = resolve(import.meta.dirname, '../artifacts/teaching', runId);
export default defineConfig({
  metadata: { os: runnerOS, browser: process.env.LAB_BROWSER, selectedUser: process.env.LAB_USER },
  projects: [{ name: `${runnerOS}-${process.env.LAB_BROWSER}-${process.env.LAB_USER}` }],
  testDir: './playwright', testMatch: 'teaching.spec.ts',
  outputDir: resolve(artifacts, 'test-results'),
  timeout: 45_000, expect: { timeout: 12_000 }, fullyParallel: true, workers: Number(requestedWorkers), retries: 0,
  reporter: [['list'], ['html', { outputFolder: resolve(artifacts, 'html'), open: 'never' }], ['junit', { outputFile: resolve(artifacts, 'junit.xml') }]],
  use: { browserName: 'chromium', channel, headless: true, ignoreHTTPSErrors: false, video: 'on', screenshot: 'only-on-failure', trace: 'off' }
});
