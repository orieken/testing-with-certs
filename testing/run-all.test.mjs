import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function executable(path, content) {
  writeFileSync(path, `#!/bin/sh\nset -eu\n${content}\n`, { mode: 0o755 });
}
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'all-services-probe-'));
  mkdirSync(join(root, 'testing')); mkdirSync(join(root, 'bin'));
  writeFileSync(join(root, 'testing/run-all.sh'), readFileSync(new URL('./run-all.sh', import.meta.url)));
  executable(join(root, 'bin/docker'), 'cat >/dev/null');
  return root;
}
function commands(root) {
  executable(join(root, 'testing/check-service-units.sh'), ':');
  executable(join(root, 'lab'), 'echo "$LAB_PROJECT $*" >> "$PROBE_ROOT/calls"; if [ "$*" = "test --runner playwright --suite contracts" ]; then exit "${PROBE_CONTRACT_STATUS:-0}"; fi');
  executable(join(root, 'testing/run-certificate-password.sh'), 'echo lesson >> "$PROBE_ROOT/calls"');
  executable(join(root, 'testing/cleanup-certificate-password.sh'), 'echo "cleanup $LAB_PROJECT" >> "$PROBE_ROOT/calls"; exit "${PROBE_CLEANUP_STATUS:-0}"');
}
function run(options) {
  const root = fixture(); commands(root);
  const env = { ...process.env, PATH: `${root}/bin:/usr/bin:/bin`, PROBE_ROOT: root, LAB_PROJECT: 'magic-shop-lab', ...options };
  const result = spawnSync('/bin/sh', [join(root, 'testing/run-all.sh'), 'all'], { env, encoding: 'utf8', timeout: 10000 });
  const calls = readFileSync(join(root, 'calls'), 'utf8'); rmSync(root, { recursive: true });
  return { result, calls };
}
test('a live failure stops later suites, preserves status, and cleans only its disposable project', () => {
  const { result, calls } = run({ PROBE_CONTRACT_STATUS: '17' });
  assert.equal(result.status, 17); assert.doesNotMatch(calls, /suite security|lesson|magic-shop-lab/);
  assert.match(calls, /cleanup magic-shop-all-[0-9]+-[0-9]+/);
});
test('all browser selections and lesson complete before cleanup; cleanup failure makes run fail', () => {
  const { result, calls } = run({ PROBE_CLEANUP_STATUS: '1' });
  assert.equal(result.status, 1); assert.equal((calls.match(/--browser /g) ?? []).length, 10);
  assert.match(calls, /lesson\ncleanup magic-shop-all-/); assert.doesNotMatch(calls, /magic-shop-lab/);
});
