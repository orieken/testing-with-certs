import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { checks } from '../reporting/password-results.mjs';
import { comparePilot } from './check-auth-pilot.mjs';
const write = (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value)); };
function fixture(t) {
  const directory = mkdtempSync(join(realpathSync(tmpdir()), 'saturday-pilot-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const root = join(directory, 'pilot'), legacy = join(directory, 'legacy');
  const lines = readFileSync(new URL('../cucumber/features/certificate-password.feature', import.meta.url), 'utf8').split('\n');
  const reports = [];
  for (const browser of ['chrome', 'msedge']) for (const runner of ['playwright', 'cucumber']) {
    const selection = `${browser}-${runner}`;
    const tests = checks.map(kind => {
      const bytes = `video-${selection}-${kind}`, hash = createHash('sha256').update(bytes).digest('hex');
      const path = `media/${hash}.webm`, producer = `recordings/${selection}/${kind}/page.webm`;
      write(join(root, selection, path), bytes); write(join(legacy, producer), bytes);
      write(join(legacy, `recordings/${selection}/${kind}/recording.json`), { browser, runner, name: kind, status: 'passed', privacy: 'provider-document-hidden-before-paint', videos: [producer] });
      return {
        id: kind, title: runner === 'playwright' ? `Certificate and password: ${kind}` : 'Same outline title', suite: ['pilot'],
        location: { file: 'cucumber/features/certificate-password.feature', line: lines.findIndex(line => line.match(new RegExp(`\\|\\s*${kind}\\s*\\|`))) + 1 },
        outcome: 'passed', metadata: {}, attempts: [{ index: 0, status: 'passed', rawStatus: runner === 'playwright' ? 'passed' : 'PASSED', durationMs: 1, steps: [], attachments: [{ name: 'Video', contentType: 'video/webm', path, availability: 'available' }] }],
      };
    });
    const report = { schemaVersion: 1, title: 'pilot', runs: [{ id: selection, shard: '1', runner, status: 'passed', metadata: { browser }, tests }] };
    write(join(root, selection, 'report.json'), report);
    write(join(legacy, selection, 'results.json'), { evidence: 'live-certificate-password', browser, runner, cases: checks.map(kind => ({ kind, status: 'passed' })) });
    reports.push({ path: join(root, selection, 'report.json'), report });
  }
  return { root, legacy, reports };
}
test('pilot comparison matches all 36 cases, outline rows, and exact producer media', async t => {
  const { root, legacy } = fixture(t);
  const result = await comparePilot(root, legacy);
  assert.equal(result.cases, 36); assert.equal(result.selections.length, 4);
  assert.ok(result.selections.every(selection => selection.videos === 9));
});
test('pilot comparison rejects a recording attached to the wrong scenario', async t => {
  const { root, legacy, reports } = fixture(t);
  const { path, report } = reports[0];
  report.runs[0].tests[0].attempts[0].attachments = report.runs[0].tests[1].attempts[0].attachments;
  write(path, report);
  await assert.rejects(comparePilot(root, legacy), /Scenario\/video association/);
});
test('pilot comparison rejects raw runner steps in credential-sensitive output', async t => {
  const { root, legacy, reports } = fixture(t);
  const { path, report } = reports[0];
  report.runs[0].tests[0].attempts[0].steps = [{ title: 'fill(value)', status: 'passed', durationMs: 1 }];
  write(path, report);
  await assert.rejects(comparePilot(root, legacy), /step titles must be omitted/);
});
test('pilot comparison scans producer-supplied labels for actual fixture secrets', async t => {
  const { root, legacy, reports } = fixture(t);
  const { path, report } = reports[0];
  report.runs[0].metadata.example = 'fixture-password-sentinel'; write(path, report);
  await assert.rejects(comparePilot(root, legacy, ['fixture-password-sentinel']), /Fixture credential leaked/);
});
