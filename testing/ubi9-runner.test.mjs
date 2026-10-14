import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

/** @issue UBI9 browser containers @ac Run beside Debian with the same certificate and VNC isolation. */
test('UBI9 desktop preserves certificate isolation and loopback-only viewer beside Debian', () => {
  const config = JSON.parse(execFileSync('docker', ['compose', '-f', 'infra/compose.yaml',
    '--profile', 'manual', '--profile', 'manual-ubi9', 'config', '--format', 'json'], {
    cwd: root, env: { ...process.env, LAB_VIEWER_PORT: '', LAB_RUNNER_IMAGE: '', LAB_RUNNER_CONTAINERFILE: '' },
    encoding: 'utf8',
  }));
  const debian = config.services['runner-manual'];
  const ubi = config.services['runner-manual-ubi9'];
  assert.equal(ubi.build.dockerfile, 'testing/container/Runner.ubi9.Containerfile');
  assert.equal(ubi.image, 'magic-shop-runner-ubi9:01');
  assert.deepEqual(ubi.profiles, ['manual-ubi9']);
  assert.deepEqual(debian.profiles, ['manual']);
  assert.equal(ubi.user, '1000:1000');
  assert.equal(ubi.platform, 'linux/amd64');
  assert.deepEqual(ubi.command, debian.command);
  assert.deepEqual(ubi.volumes, debian.volumes);
  assert.ok(ubi.volumes.every(volume => volume.read_only));
  assert.deepEqual(ubi.ports.map(port => [port.host_ip, port.published, port.target]),
    [['127.0.0.1', '6082', 6080]]);
  assert.equal(debian.ports[0].published, '6080');
});

/** @issue UBI9 browser containers @ac Start, retrieve password and stop the selected desktop. */
test('lab selects the same UBI9 service for start, password and cleanup', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ubi9-lab-'));
  const capture = join(directory, 'capture');
  writeFileSync(join(directory, 'docker'), '#!/bin/sh\nprintf "%s\\n" "$LAB_RUNNER_IMAGE" "$LAB_RUNNER_CONTAINERFILE" "$LAB_VIEWER_PORT" "$@" > "$CAPTURE"\n', { mode: 0o755 });
  const env = { ...process.env, PATH: `${directory}:${process.env.PATH}`, CAPTURE: capture,
    LAB_RUNNER_OS: 'ubi9', LAB_VIEWER_PORT: '' };
  try {
    for (const args of [['manual', '--user', 'shop-admin', '--browser', 'msedge'],
      ['viewer-password'], ['manual', 'stop']]) {
      execFileSync('./lab', args, { cwd: root, env });
      const invocation = readFileSync(capture, 'utf8').split('\n');
      assert.deepEqual(invocation.slice(0, 3), ['magic-shop-runner-ubi9:01',
        'testing/container/Runner.ubi9.Containerfile', '6082']);
      assert.ok(invocation.includes('manual-ubi9'));
      assert.ok(invocation.includes('runner-manual-ubi9'));
      assert.ok(!invocation.includes('runner-manual'));
    }
    assert.throws(() => execFileSync('./lab', ['manual', 'stop'], {
      cwd: root, env: { ...env, LAB_RUNNER_OS: 'unknown' }, stdio: 'pipe',
    }));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

/** @issue UBI9 browser containers @ac Automated runners select UBI9 without changing the Debian desktop. */
test('automated runner selection keeps the Debian desktop independent', () => {
  const config = JSON.parse(execFileSync('docker', ['compose', '-f', 'infra/compose.yaml',
    '--profile', 'test', '--profile', 'manual', 'config', '--format', 'json'], {
    cwd: root, encoding: 'utf8', env: { ...process.env,
      LAB_RUNNER_IMAGE: 'magic-shop-runner-ubi9:01',
      LAB_RUNNER_CONTAINERFILE: 'testing/container/Runner.ubi9.Containerfile' },
  }));
  assert.equal(config.services['runner-test'].build.dockerfile, 'testing/container/Runner.ubi9.Containerfile');
  for (const [name, service] of Object.entries(config.services)) {
    if (name.startsWith('runner-') && name !== 'runner-manual') {
      assert.equal(service.image, 'magic-shop-runner-ubi9:01', name);
    }
  }
  assert.equal(config.services['runner-manual'].image, 'magic-shop-runner:03');
});
