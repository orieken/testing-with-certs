import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

function probe(os, args, runId) {
  const root = mkdtempSync(join(tmpdir(), 'lab-report-'));
  mkdirSync(join(root, 'bin'));
  writeFileSync(join(root, 'lab'), readFileSync(new URL('../lab', import.meta.url)), { mode: 0o755 });
  const capture = join(root, 'calls');
  writeFileSync(join(root, 'bin/docker'), '#!/bin/sh\nprintf "%s %s %s\\n" "$LAB_RUN_ID" "$LAB_RUNNER_OS" "$LAB_RUNNER_IMAGE" >> "$CAPTURE"\n', { mode: 0o755 });
  try {
    const result = spawnSync(join(root, 'lab'), args, { encoding: 'utf8', env: {
      ...process.env, PATH: `${root}/bin:${process.env.PATH}`, CAPTURE: capture,
      LAB_RUNNER_OS: os, LAB_RUN_ID: runId ?? '',
    } });
    let calls = '';
    try { calls = readFileSync(capture, 'utf8'); } catch {}
    return { ...result, calls };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

/** @issue OS report names @ac Each browser report identifies OS, browser, runner and user. */
test('teaching and recorded run names identify each OS selection', () => {
  for (const os of ['debian', 'ubi9']) {
    for (const args of [['test', '--runner', 'playwright', '--browser', 'chrome', '--user', 'shop-admin'], ['record', 'chrome', 'shop-admin']]) {
      const result = probe(os, args);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.calls, new RegExp(`-${os}-playwright-chrome-shop-admin-`));
      assert.match(result.calls, new RegExp(` ${os} magic-shop-runner${os === 'ubi9' ? '-ubi9:01' : ':03'}`));
    }
  }
});

/** @issue OS report names @ac Matrix supplies a stable ID without allowing report path traversal. */
test('matrix IDs are preserved and unsafe IDs fail before Docker executes', () => {
  const args = ['test', '--runner', 'cucumber', '--browser', 'msedge', '--user', 'shop-admin'];
  const valid = probe('ubi9', args, 'matrix-ubi9-cucumber-msedge-shop-admin-01');
  assert.equal(valid.status, 0);
  assert.match(valid.calls, /^matrix-ubi9-cucumber-msedge-shop-admin-01 ubi9 /);
  const invalid = probe('ubi9', args, '../../escape');
  assert.equal(invalid.status, 2);
  assert.equal(invalid.calls, '');
});
