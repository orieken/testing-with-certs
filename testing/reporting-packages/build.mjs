import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export const packages = ['saturday-reporting', 'saturday-playwright-reporter', 'saturday-cucumber-formatter'];
export const root = fileURLToPath(new URL('../../', import.meta.url));
export function build() {
  for (const name of packages) {
    const directory = new URL(`../../packages/${name}/`, import.meta.url);
    const require = createRequire(new URL('package.json', directory));
    const result = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.json'], { cwd: directory, stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`Build failed: ${name}`);
  }
  const assets = spawnSync(process.execPath, ['packages/saturday-reporting/build-assets.mjs'], { cwd: root, stdio: 'inherit' });
  if (assets.status !== 0) throw new Error('Runtime asset build failed');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) build();
