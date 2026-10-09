import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const mode = process.argv[2];
if (mode !== 'generate' && mode !== 'check') throw new Error('Usage: contracts-tooling.mjs generate|check');
const contractRoot = resolve(import.meta.dirname, '../contracts');
const names = ['catalog', 'customer', 'insights'];
const temp = mkdtempSync(join(tmpdir(), 'magic-contracts-'));

function run(command, args) {
  const result = spawnSync(command, args, { cwd: contractRoot, encoding: 'utf8', timeout: 60000, maxBuffer: 2_000_000 });
  if (result.error || result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed: ${result.error?.message ?? result.stderr ?? result.stdout}`);
}
function syncFile(relative, content) {
  const target = join(contractRoot, relative);
  if (mode === 'generate') {
    mkdirSync(resolve(target, '..'), { recursive: true });
    writeFileSync(target, content);
    return;
  }
  let existing;
  try { existing = readFileSync(target); } catch { throw new Error(`${relative} missing; run contracts generate`); }
  if (!existing.equals(content)) throw new Error(`${relative} differs from canonical OpenAPI; run contracts generate`);
}
try {
  const digests = { schemaVersion: 1, generatedFrom: 'contracts/openapi/*.yaml', services: {} };
  for (const name of names) {
    const source = `openapi/${name}.yaml`;
    const bundlePath = join(temp, `${name}.json`);
    const typesPath = join(temp, `${name}.d.ts`);
    run('redocly', ['bundle', source, '--ext', 'json', '--output', bundlePath]);
    run('openapi-typescript', [source, '--output', typesPath]);
    const bundle = readFileSync(bundlePath);
    const types = readFileSync(typesPath);
    const doc = JSON.parse(bundle.toString('utf8'));
    const operations = Object.values(doc.paths).flatMap((path) => Object.values(path)).filter((value) => value && typeof value === 'object' && 'operationId' in value).length;
    syncFile(`bundled/${name}.json`, bundle);
    syncFile(`generated/${name}.d.ts`, types);
    digests.services[name] = { sha256: createHash('sha256').update(bundle).digest('hex'), operations };
  }
  syncFile('bundled/digests.json', Buffer.from(`${JSON.stringify(digests, null, 2)}\n`));
  console.log(`PASS: ${mode} three bundles, three TypeScript declarations and digests`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
