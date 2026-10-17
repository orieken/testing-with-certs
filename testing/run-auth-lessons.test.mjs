import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function run(options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'auth-lessons-runner-'));
  try {
    mkdirSync(join(root, 'testing')); mkdirSync(join(root, 'bin'));
    writeFileSync(join(root, 'testing/run-auth-lessons.sh'), readFileSync(new URL('./run-auth-lessons.sh', import.meta.url)));
    writeFileSync(join(root, 'testing/start-auth-lessons.sh'), '#!/bin/sh\necho startup >> "$PROBE_ROOT/calls"\n');
    writeFileSync(join(root, 'bin/docker'), `#!/bin/sh
echo "$*" >> "$PROBE_ROOT/calls"
case "$*" in
  *" ls -q "*|"ps -aq "*) if [ "\${PROBE_EXISTING:-0}" = 1 ]; then echo existing; fi;;
  *"cucumber-js"*) exit "\${PROBE_CUCUMBER_FAIL:-0}";;
  *"playwright.auth-lessons.config.mjs"*) exit "\${PROBE_FAIL:-0}";;
esac
`, { mode: 0o755 });
    const result = spawnSync('/bin/sh', [join(root, 'testing/run-auth-lessons.sh')], {
      encoding: 'utf8', timeout: 10_000,
      env: { ...process.env, PATH: `${root}/bin:/usr/bin:/bin`, PROBE_ROOT: root,
        LAB_PROJECT: 'magic-shop-auth-probe', ...options },
    });
    return { status: result.status, calls: existsSync(join(root, 'calls')) ? readFileSync(join(root, 'calls'), 'utf8') : '' };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('existing resources are refused before any startup or teardown', () => {
  const result = run({ PROBE_EXISTING: '1' });
  assert.equal(result.status, 2);
  assert.doesNotMatch(result.calls, /startup|down|fixture/);
});
test('browser failure preserves failure status and still removes only the disposable project', () => {
  const result = run({ PROBE_FAIL: '17' });
  assert.equal(result.status, 17);
  assert.match(result.calls, /auth-lesson-fixture finish/);
  assert.match(result.calls, /auth-lesson-fixture verify/);
  assert.match(result.calls, /--profile \* down --volumes --remove-orphans/);
  assert.doesNotMatch(result.calls, /kerberos-disable/);
});
test('both browsers execute passkey/federation and valid/disabled Kerberos phases', () => {
  const result = run();
  assert.equal(result.status, 0);
  assert.equal((result.calls.match(/playwright.auth-lessons.config.mjs/g) ?? []).length, 6);
  assert.equal((result.calls.match(/auth-lesson-fixture kerberos-disable/g) ?? []).length, 2);
  assert.equal((result.calls.match(/cucumber-js/g) ?? []).length, 2);
  assert.match(result.calls, /--order random/);
  assert.match(result.calls, /check-artifacts.mjs/);
});

test('Cucumber failure preserves exit status and still cleans its fixtures and project', () => {
  const result = run({ PROBE_CUCUMBER_FAIL: '17' });
  assert.equal(result.status, 17);
  assert.match(result.calls, /auth-lesson-fixture finish/);
  assert.match(result.calls, /auth-lesson-fixture verify/);
  assert.match(result.calls, /--profile \* down --volumes --remove-orphans/);
  assert.doesNotMatch(result.calls, /LAB_BROWSER=msedge/);
});
