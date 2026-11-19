import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build, root } from './build.mjs';
import { coverageFiles } from './coverage-policy.mjs';

export const unitTestFiles = [
  'packages/saturday-reporting/test/reporting.test.mjs',
  'packages/saturday-playwright-reporter/test/callbacks.test.mjs',
  'packages/saturday-cucumber-formatter/test/callbacks.test.mjs',
  'testing/reporting-packages/auth-pilot.test.mjs',
  'testing/reporting-packages/coverage.test.mjs',
];

export function runUnitTests({ buildPackages = true } = {}) {
  if (buildPackages) build();
  const coverage = resolve(process.env.SATURDAY_COVERAGE_DIR ?? join(root, 'artifacts/saturday-reporting/coverage'));
  mkdirSync(coverage, { recursive: true });
  const result = spawnSync(process.execPath, [
    '--experimental-test-module-mocks', '--experimental-test-coverage',
    ...coverageFiles.map(file => `--test-coverage-include=${file}`),
    '--test-reporter=spec', '--test-reporter-destination=stdout',
    '--test-reporter=./testing/reporting-packages/coverage-reporter.mjs', `--test-reporter-destination=${join(coverage, 'gates.txt')}`,
    '--test-reporter=lcov', `--test-reporter-destination=${join(coverage, 'lcov.info')}`,
    '--test', ...unitTestFiles,
  ], {
    cwd: root, stdio: 'inherit',
  });
  if (result.status !== 0) throw result.error ?? new Error('Saturday reporting unit tests failed');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) runUnitTests();
