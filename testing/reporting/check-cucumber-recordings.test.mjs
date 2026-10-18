import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('recording acceptance rejects mismatched names, hook failures, and disabled clips', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cucumber-index-'));
  const check = policy => spawnSync(process.execPath, [new URL('./check-cucumber-recordings.mjs', import.meta.url).pathname, root, policy], { encoding: 'utf8' });
  const report = [{ uri: 'test.feature', elements: [{ type: 'scenario', name: 'Observed scenario', steps: [{ result: { status: 'passed' } }] }] }];
  const index = { evidence: 'verified-authentication-video-cases', cases: [{ path: 'clip.webm', spec: 'test.feature', name: 'Observed scenario', status: 'PASSED' }] };
  try {
    await writeFile(join(root, 'cucumber.json'), JSON.stringify(report));
    await writeFile(join(root, 'clip.webm'), 'fixture');
    await writeFile(join(root, 'video-cases.json'), JSON.stringify(index));
    assert.equal(check('enabled').status, 0);
    index.cases[0].name = 'Wrong scenario';
    await writeFile(join(root, 'video-cases.json'), JSON.stringify(index));
    assert.notEqual(check('enabled').status, 0);
    await writeFile(join(root, 'recording-policy.json'), JSON.stringify({ evidence: 'explicit-recording-policy', recording: 'disabled', cases: [{ spec: 'test.feature', name: 'Observed scenario', status: 'PASSED' }] }));
    assert.notEqual(check('disabled').status, 0);
    await rm(join(root, 'clip.webm'));
    assert.equal(check('disabled').status, 0);
    report[0].elements[0].after = [{ result: { status: 'failed' } }];
    await writeFile(join(root, 'cucumber.json'), JSON.stringify(report));
    assert.notEqual(check('disabled').status, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});
