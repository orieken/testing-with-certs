import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync, statSync, lstatSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authPhases, otpPhases } from '../teaching/auth-matrix.mjs';
import { checks } from './password-results.mjs';

export function indexAuthRecordings(suite, root) {
  assert.ok(['auth-lessons', 'password-otp', 'certificate-password'].includes(suite));
  root = resolve(root);
  const expected = new Map();
  const add = (browser, runner, phase, method, name, status) => {
    assert.equal(status, 'passed'); const key = [browser, runner, phase, method, name].join('|');
    assert.ok(!expected.has(key)); expected.set(key, false);
  };
  for (const browser of ['chrome', 'msedge']) {
    if (suite === 'auth-lessons') for (const [phase, names] of Object.entries(authPhases)) {
      const report = JSON.parse(readFileSync(join(root, `${browser}-${phase}`, 'results.json')));
      assert.equal(report.evidence, 'live-authentication-lessons'); assert.equal(report.browser, browser); assert.equal(report.phase, phase);
      assert.deepEqual(report.cases.map(v => v.name).sort(), [...names].sort());
      for (const entry of report.cases) add(browser, phase.includes('cucumber') ? 'cucumber' : 'playwright',
        phase.includes('lifecycle') ? 'lifecycle' : phase.includes('disabled') ? 'disabled' : 'baseline', entry.name.split(':')[0], entry.name, entry.status);
    }
    else if (suite === 'password-otp') for (const [selection, names] of Object.entries(otpPhases)) {
      const report = JSON.parse(readFileSync(join(root, `${browser}-${selection}`, 'results.json')));
      const runner = selection.split('-')[0], phase = selection.endsWith('-lifecycle') ? 'lifecycle' : 'baseline';
      assert.equal(report.evidence, 'live-password-otp'); assert.equal(report.browser, browser); assert.equal(report.runner, runner); assert.equal(report.phase, phase);
      assert.deepEqual(report.cases.map(v => v.name).sort(), [...names].sort());
      for (const entry of report.cases) add(browser, runner, phase, 'password-totp', entry.name, entry.status);
    }
    else for (const runner of ['playwright', 'cucumber']) {
      const report = JSON.parse(readFileSync(join(root, `${browser}-${runner}`, 'results.json')));
      assert.equal(report.evidence, 'live-certificate-password'); assert.equal(report.browser, browser); assert.equal(report.runner, runner);
      assert.deepEqual(report.cases.map(v => v.kind).sort(), [...checks].sort());
      for (const entry of report.cases) add(browser, runner, 'baseline', 'certificate-password', entry.kind, entry.status);
    }
  }
  const groups = new Map(); let videoCount = 0;
  function visit(directory) {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name), info = lstatSync(path); assert.ok(!info.isSymbolicLink());
      if (info.isDirectory()) { visit(path); continue; }
      if (name !== 'recording.json') continue;
      const record = JSON.parse(readFileSync(path));
      assert.equal(record.evidence, 'live-authentication-recording'); assert.equal(record.status, 'passed');
      assert.equal(record.privacy, 'provider-document-hidden-before-paint');
      const key = [record.browser, record.runner, record.phase, record.auth_type, record.name].join('|');
      assert.equal(expected.get(key), false, 'Unknown or duplicate recording'); expected.set(key, true);
      assert.ok(Array.isArray(record.videos) && record.videos.length > 0);
      const groupPath = dirname(dirname(path));
      const group = groups.get(groupPath) ?? { record, cases: [] };
      for (const video of record.videos) {
        assert.ok(typeof video === 'string' && video.endsWith('.webm'));
        const full = resolve(root, video); assert.ok(full.startsWith(`${dirname(path)}/`));
        assert.ok(lstatSync(full).isFile() && !lstatSync(full).isSymbolicLink() && statSync(full).size > 0);
        group.cases.push({ path: relative(groupPath, full).split('\\').join('/'), name: record.name, spec: record.spec, status: record.status }); videoCount++;
      }
      groups.set(groupPath, group);
    }
  }
  assert.ok(existsSync(join(root, 'recordings')), 'No recordings'); visit(join(root, 'recordings'));
  assert.ok([...expected.values()].every(Boolean), 'Required case recording missing');
  const rows = [];
  for (const [directory, group] of groups) {
    writeFileSync(join(directory, 'video-cases.json'), JSON.stringify({ evidence: 'verified-authentication-video-cases', cases: group.cases }, null, 2));
    const r = group.record;
    rows.push({ os: 'debian', browser: r.browser, runner: r.runner, user: 'isolated test fixtures', suite: `${r.auth_type}-${r.phase}`,
      auth_type: r.auth_type, run_id: `${root.split('/').at(-1)}-${r.browser}-${r.runner}-${r.auth_type}-${r.phase}`,
      report: relative(root, directory).split('\\').join('/'), status: 'passed' });
  }
  writeFileSync(join(root, 'recording-matrix.json'), JSON.stringify({ id: root.split('/').at(-1), status: 'passed', passed: rows.length, failed: 0, rows }, null, 2));
  return { cases: expected.size, videos: videoCount, selections: rows.length };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(indexAuthRecordings(process.argv[2], process.argv[3]));
