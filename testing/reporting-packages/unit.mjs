import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build, root } from './build.mjs';

export const unitTestFiles = [
  'packages/saturday-reporting/test/reporting.test.mjs',
  'packages/saturday-playwright-reporter/test/callbacks.test.mjs',
  'packages/saturday-cucumber-formatter/test/callbacks.test.mjs',
  'testing/reporting-packages/auth-pilot.test.mjs',
];

export function runUnitTests({ buildPackages = true } = {}) {
  if (buildPackages) build();
  const result = spawnSync(process.execPath, ['--experimental-test-module-mocks', '--test', ...unitTestFiles], {
    cwd: root, stdio: 'inherit',
  });
  if (result.status !== 0) throw result.error ?? new Error('Saturday reporting unit tests failed');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) runUnitTests();
