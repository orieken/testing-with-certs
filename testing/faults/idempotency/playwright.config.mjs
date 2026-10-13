import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
export default defineConfig({
  timeout: 40000, workers: 1, retries: 0,
  outputDir: '/home/runner/test-results',
  use: { ignoreHTTPSErrors: false, trace: 'off', video: 'off', screenshot: 'off' },
  reporter: [['./reporter.mjs'], ['../../api/contracts/coverage-reporter.ts']],
  projects: [
    { name: 'live-contracts', testDir: resolve(import.meta.dirname, '../../api/contracts'), testMatch: ['*.contract.spec.ts', 'validator.spec.ts'] },
    { name: 'checkout-idempotency', testDir: import.meta.dirname, testMatch: 'idempotency.spec.mjs', dependencies: ['live-contracts'] }
  ]
});
