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
  *"LAB_AUTH_SUITE=kerberos-lifecycle"*"playwright test"*) exit "\${PROBE_KERBEROS_LIFECYCLE_PW_FAIL:-0}";;
  *"LAB_AUTH_SUITE=kerberos-lifecycle"*"cucumber-js"*) exit "\${PROBE_KERBEROS_LIFECYCLE_CUCUMBER_FAIL:-0}";;
  *"LAB_AUTH_SUITE=saml-lifecycle"*"playwright test"*) exit "\${PROBE_SAML_LIFECYCLE_PW_FAIL:-0}";;
  *"LAB_AUTH_SUITE=saml-lifecycle"*"cucumber-js"*) exit "\${PROBE_SAML_LIFECYCLE_CUCUMBER_FAIL:-0}";;
  *"LAB_AUTH_SUITE=oidc-lifecycle"*"playwright test"*) exit "\${PROBE_OIDC_LIFECYCLE_PW_FAIL:-0}";;
  *"LAB_AUTH_SUITE=oidc-lifecycle"*"cucumber-js"*) exit "\${PROBE_OIDC_LIFECYCLE_CUCUMBER_FAIL:-0}";;
  *"LAB_AUTH_SUITE=passkeys-lifecycle"*"playwright test"*) exit "\${PROBE_LIFECYCLE_PW_FAIL:-0}";;
  *"LAB_AUTH_SUITE=passkeys-lifecycle"*"cucumber-js"*) exit "\${PROBE_LIFECYCLE_CUCUMBER_FAIL:-0}";;
  *"LAB_KERBEROS_DISABLED=1"*"cucumber/kerberos.mjs"*) exit "\${PROBE_KERBEROS_DISABLED_FAIL:-0}";;
  *"cucumber/kerberos.mjs"*) exit "\${PROBE_KERBEROS_FAIL:-0}";;
  *"LAB_CUCUMBER_METHOD=saml"*) exit "\${PROBE_SAML_FAIL:-0}";;
  *"LAB_CUCUMBER_METHOD=oidc"*) exit "\${PROBE_OIDC_FAIL:-0}";;
  *"cucumber-js"*) exit "\${PROBE_CUCUMBER_FAIL:-0}";;
  *"playwright.auth-lessons.config.mjs"*) exit "\${PROBE_FAIL:-0}";;
esac
`, { mode: 0o755 });
    if (options.PROBE_STALE_REPORTS === '1') {
      const reports = join(root, 'artifacts/auth-lessons/magic-shop-auth-probe');
      mkdirSync(reports, { recursive: true }); writeFileSync(join(reports, 'old.json'), '{}');
    }
    const result = spawnSync('/bin/sh', [join(root, 'testing/run-auth-lessons.sh'), ...(options.PROBE_OIDC_ONLY === '1' ? ['oidc'] : [])], {
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
  assert.equal((result.calls.match(/playwright.auth-lessons.config.mjs/g) ?? []).length, 14);
  assert.equal((result.calls.match(/auth-lesson-fixture kerberos-disable/g) ?? []).length, 2);
  assert.equal((result.calls.match(/cucumber-js/g) ?? []).length, 18);
  assert.match(result.calls, /--order random/);
  assert.equal((result.calls.match(/auth-lesson-fixture start-passkeys-lifecycle/g) ?? []).length, 4);
  assert.equal((result.calls.match(/auth-lesson-fixture finish/g) ?? []).length, 25);
  assert.equal((result.calls.match(/auth-lesson-fixture verify/g) ?? []).length, 25);
  assert.equal((result.calls.match(/LAB_LIFECYCLE_METHOD=passkeys/g) ?? []).length, 4);
  assert.equal((result.calls.match(/LAB_LIFECYCLE_METHOD=oidc/g) ?? []).length, 4);
  assert.equal((result.calls.match(/LAB_LIFECYCLE_METHOD=saml/g) ?? []).length, 4);
  assert.equal((result.calls.match(/auth-lesson-fixture start-saml-lifecycle/g) ?? []).length, 4);
  assert.equal((result.calls.match(/auth-lesson-fixture start-oidc-lifecycle/g) ?? []).length, 4);
  assert.equal((result.calls.match(/LAB_CUCUMBER_METHOD=oidc/g) ?? []).length, 2);
  assert.equal((result.calls.match(/LAB_CUCUMBER_METHOD=saml/g) ?? []).length, 2);
  assert.equal((result.calls.match(/cucumber\/kerberos.mjs/g) ?? []).length, 4);
  assert.match(result.calls, /--tags "not @disabled"/);
  assert.match(result.calls, /--tags @disabled/);
  assert.equal((result.calls.match(/auth-lesson-fixture start-kerberos-lifecycle/g) ?? []).length, 4);
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

test('OIDC Cucumber failure cleans fixtures and prevents the next browser selection', () => {
  const result = run({ PROBE_OIDC_FAIL: '19' });
  assert.equal(result.status, 19);
  assert.match(result.calls, /LAB_CUCUMBER_METHOD=passkeys/);
  assert.match(result.calls, /LAB_CUCUMBER_METHOD=oidc/);
  assert.match(result.calls, /auth-lesson-fixture finish/);
  assert.match(result.calls, /auth-lesson-fixture verify/);
  assert.match(result.calls, /--profile \* down --volumes --remove-orphans/);
  assert.doesNotMatch(result.calls, /LAB_BROWSER=msedge/);
});

test('SAML Cucumber failure cleans fixtures and prevents the next browser selection', () => {
  const result = run({ PROBE_SAML_FAIL: '21' });
  assert.equal(result.status, 21);
  assert.match(result.calls, /LAB_CUCUMBER_METHOD=oidc/);
  assert.match(result.calls, /LAB_CUCUMBER_METHOD=saml/);
  assert.match(result.calls, /auth-lesson-fixture finish/);
  assert.match(result.calls, /auth-lesson-fixture verify/);
  assert.match(result.calls, /--profile \* down --volumes --remove-orphans/);
  assert.doesNotMatch(result.calls, /LAB_BROWSER=msedge/);
});

test('Kerberos Cucumber failure cleans the project before any disabled-user phase', () => {
  const result = run({ PROBE_KERBEROS_FAIL: '23' });
  assert.equal(result.status, 23);
  assert.match(result.calls, /auth-lesson-fixture finish/);
  assert.match(result.calls, /auth-lesson-fixture verify/);
  assert.match(result.calls, /--profile \* down --volumes --remove-orphans/);
  assert.doesNotMatch(result.calls, /kerberos-disable|LAB_BROWSER=msedge/);
});
test('disabled Kerberos Cucumber failure disposes the isolated disabled-account realm', () => {
  const result = run({ PROBE_KERBEROS_DISABLED_FAIL: '25' });
  assert.equal(result.status, 25);
  assert.match(result.calls, /auth-lesson-fixture kerberos-disable/);
  assert.match(result.calls, /auth-lesson-fixture finish/);
  assert.match(result.calls, /auth-lesson-fixture verify/);
  assert.match(result.calls, /--profile \* down --volumes --remove-orphans/);
  assert.doesNotMatch(result.calls, /kerberos-enable|LAB_BROWSER=msedge/);
});

for (const runner of ['PW', 'CUCUMBER']) test(`passkey lifecycle ${runner} failure restores fixtures and tears down the project`, () => {
  const result = run({ [`PROBE_LIFECYCLE_${runner}_FAIL`]: '27' });
  assert.equal(result.status, 27);
  assert.match(result.calls, /auth-lesson-fixture start-passkeys-lifecycle/);
  assert.match(result.calls, /auth-lesson-fixture finish/);
  assert.match(result.calls, /auth-lesson-fixture verify/);
  assert.match(result.calls, /--profile \* down --volumes --remove-orphans/);
  assert.doesNotMatch(result.calls, /LAB_BROWSER=msedge/);
});

for (const runner of ['PW', 'CUCUMBER']) test(`OIDC lifecycle ${runner} failure restores fixtures and tears down the project`, () => {
  const result = run({ [`PROBE_OIDC_LIFECYCLE_${runner}_FAIL`]: '29' });
  assert.equal(result.status, 29);
  assert.match(result.calls, /auth-lesson-fixture start-oidc-lifecycle/);
  assert.match(result.calls, /auth-lesson-fixture finish/);
  assert.match(result.calls, /auth-lesson-fixture verify/);
  assert.match(result.calls, /--profile \* down --volumes --remove-orphans/);
  assert.doesNotMatch(result.calls, /LAB_BROWSER=msedge/);
});

for (const runner of ['PW', 'CUCUMBER']) test(`SAML lifecycle ${runner} failure restores fixtures and tears down the project`, () => {
  const result = run({ [`PROBE_SAML_LIFECYCLE_${runner}_FAIL`]: '31' });
  assert.equal(result.status, 31);
  assert.match(result.calls, /auth-lesson-fixture start-saml-lifecycle/);
  assert.match(result.calls, /auth-lesson-fixture finish/);
  assert.match(result.calls, /auth-lesson-fixture verify/);
  assert.match(result.calls, /--profile \* down --volumes --remove-orphans/);
  assert.doesNotMatch(result.calls, /LAB_BROWSER=msedge/);
});

for (const runner of ['PW', 'CUCUMBER']) test(`Kerberos lifecycle ${runner} failure restores fixtures and tears down the project`, () => {
  const result = run({ [`PROBE_KERBEROS_LIFECYCLE_${runner}_FAIL`]: '33' });
  assert.equal(result.status, 33);
  assert.match(result.calls, /auth-lesson-fixture start-kerberos-lifecycle/);
  assert.match(result.calls, /auth-lesson-fixture finish/);
  assert.match(result.calls, /auth-lesson-fixture verify/);
  assert.match(result.calls, /--profile \* down --volumes --remove-orphans/);
  assert.doesNotMatch(result.calls, /LAB_BROWSER=msedge/);
});

test('focused OIDC runs every baseline/lifecycle browser/runner and applies only the scoped gates', () => {
  const result = run({ PROBE_OIDC_ONLY: '1' });
  assert.equal(result.status, 0);
  for (const browser of ['chrome', 'msedge']) assert.match(result.calls, new RegExp(`LAB_BROWSER=${browser}`));
  assert.equal((result.calls.match(/playwright.auth-lessons.config.mjs/g) ?? []).length, 4);
  assert.equal((result.calls.match(/cucumber-js/g) ?? []).length, 4);
  assert.equal((result.calls.match(/auth-lesson-fixture start-oidc-lifecycle/g) ?? []).length, 4);
  assert.equal((result.calls.match(/auth-lesson-fixture finish/g) ?? []).length, 9);
  assert.match(result.calls, /check-auth-matrix.mjs oidc/);
  assert.match(result.calls, /auth-recording-index.mjs oidc/);
  assert.doesNotMatch(result.calls, /kerberos-disable|lesson-kdc|LAB_LIFECYCLE_METHOD=passkeys/);
});

test('focused OIDC refuses stale artifacts before startup', () => {
  const result = run({ PROBE_OIDC_ONLY: '1', PROBE_STALE_REPORTS: '1' });
  assert.equal(result.status, 2);
  assert.doesNotMatch(result.calls, /startup|down|fixture/);
});

test('focused OIDC failure preserves status and cleans the project without entering another browser', () => {
  const result = run({ PROBE_OIDC_ONLY: '1', PROBE_FAIL: '17' });
  assert.equal(result.status, 17);
  assert.match(result.calls, /auth-lesson-fixture finish/);
  assert.match(result.calls, /auth-lesson-fixture verify/);
  assert.match(result.calls, /down --volumes --remove-orphans/);
  assert.doesNotMatch(result.calls, /LAB_BROWSER=msedge/);
});
