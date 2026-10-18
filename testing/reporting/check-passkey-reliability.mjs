import assert from 'node:assert/strict';
import { readFile, readdir, lstat } from 'node:fs/promises';
import { resolve, join, relative, dirname } from 'node:path';
import { passkeyCaseNames } from '../teaching/auth-matrix.mjs';
import { safePasskeyDiagnostic } from '../teaching/passkey-diagnostics.mjs';
const root = process.argv[2];
if (!root) throw new Error('Provide the passkey reliability report root');
async function walk(dir) {
  const files = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    assert.ok(!item.isSymbolicLink(), 'Report symlinks forbidden');
    if (item.isDirectory()) files.push(...await walk(path)); else files.push(path);
  }
  return files;
}
let executions = 0, videos = 0;
for (const round of [1, 2]) {
  const folder = resolve(root, `round-${round}`);
  const files = await walk(folder);
  const recordings = await Promise.all(files.filter(path => path.endsWith('/recording.json')).map(async path => ({ path, data: JSON.parse(await readFile(path, 'utf8')) })));
  assert.equal(recordings.length, 28);
  for (const browser of ['chrome', 'msedge']) for (const runner of ['playwright', 'cucumber']) {
    const phase = runner === 'playwright' ? 'passkeys-federation' : 'passkeys-cucumber';
    const report = join(folder, `${browser}-${phase}`);
    const result = JSON.parse(await readFile(join(report, 'results.json'), 'utf8'));
    assert.deepEqual(result.cases.map(c => c.name).sort(), [...passkeyCaseNames].sort());
    assert.ok(result.cases.every(c => c.status === 'passed'));
    const diagnostics = JSON.parse(await readFile(join(report, 'diagnostics.json'), 'utf8'));
    assert.equal(diagnostics.evidence, 'allowlisted-passkey-diagnostics');
    assert.ok(diagnostics.events.length > 0);
    for (const event of diagnostics.events) {
      assert.ok(safePasskeyDiagnostic(event));
      assert.ok(!event.stage.endsWith('failed') && !event.observationFailed);
      if (event.stage === 'control-ready') assert.equal(event.documentComplete, true);
    }
    assert.ok(diagnostics.events.some(e => e.name === 'passkeys:enrollment' && e.stage === 'enrollment-passed' && e.moduleDelayed));
    assert.ok(diagnostics.events.some(e => e.name === 'passkeys:invalid-signature' && e.stage === 'rejection-passed' && e.signatureChanged && e.moduleDelayed && e.identity === false));
    const selected = recordings.filter(r => r.data.browser === browser && r.data.runner === runner);
    assert.deepEqual(selected.map(r => r.data.name).sort(), [...passkeyCaseNames].sort());
    for (const { path, data } of selected) {
      assert.equal(data.status, 'passed'); assert.equal(data.phase, 'baseline');
      assert.equal(data.evidence, 'live-authentication-recording');
      assert.equal(data.privacy, 'provider-document-hidden-before-paint');
      assert.ok(data.videos.length > 0);
      for (const clip of data.videos) {
        const file = resolve(folder, clip), rel = relative(dirname(path), file);
        assert.ok(rel && !rel.startsWith('..'));
        const stat = await lstat(file); assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0);
        videos++;
      }
      executions++;
    }
  }
}
assert.equal(executions, 56);
console.log(`Passkey reliability: ${executions} passing baseline executions, ${videos} recordings, both rounds/browsers/runners, allowlisted readiness and rejection diagnostics verified`);
