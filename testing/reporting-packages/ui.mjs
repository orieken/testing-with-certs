import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, root } from './build.mjs';
export function runUiTests({ buildPackages = true, args = [] } = {}) {
  if (buildPackages) build();
  execFileSync(process.execPath, [
    join(root, 'packages/saturday-playwright-reporter/node_modules/@playwright/test/cli.js'),
    'test', '--config', 'testing/reporting-packages/ui.config.mjs', ...args,
  ], { cwd: root, stdio: 'inherit' });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) runUiTests({ args: process.argv.slice(2) });
