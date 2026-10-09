import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'api/contracts',
  outputDir: process.env.LAB_SECURITY_RUN === '1' ? '/home/runner/security-results' : process.env.LAB_CONTRACT_REPORT_DIR ? '/home/runner/contract-test-results' : undefined,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: 0,
  reporter: process.env.LAB_SECURITY_RUN === '1' ? [['list']] : [
    ['list'],
    ['html', { outputFolder: process.env.LAB_CONTRACT_RUN_DIR ? `${process.env.LAB_CONTRACT_RUN_DIR}/html` : '/home/runner/contract-html', open: 'never' }],
    ['junit', { outputFile: process.env.LAB_CONTRACT_RUN_DIR ? `${process.env.LAB_CONTRACT_RUN_DIR}/junit.xml` : '/home/runner/contract-junit.xml' }],
    ['./api/contracts/coverage-reporter.ts']
  ],
  use: { ignoreHTTPSErrors: false, trace: 'off' },
  projects: [
    { name: 'contracts-validator', testMatch: 'validator.spec.ts' },
    { name: 'contracts', testMatch: '*.contract.spec.ts' },
    { name: 'security', testDir: 'api/security', testMatch: '*.spec.ts' }
  ]
});
