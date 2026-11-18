import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, symlinkSync, rmSync, renameSync, realpathSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { mergeReports, outcome, writeReport, validateReport } from '../dist/index.js';

function fixture(t) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'saturday-core-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const report = {
    schemaVersion: 1, title: 'A <report> & "title"',
    runs: [{ id: 'run', shard: '1', runner: 'playwright', status: 'failed', metadata: {}, tests: [{
      id: 'test', title: '</script><img src=x onerror="window.pwned=1">', suite: ['suite'], outcome: 'failed', metadata: {},
      attempts: [{ index: 0, status: 'failed', rawStatus: 'failed', durationMs: 3, steps: [], attachments: [] }],
    }] }],
  };
  const outputDir = join(root, 'output');
  return { root, outputDir, report, attachments: report.runs[0].tests[0].attempts[0].attachments };
}
test('portable output escapes markup, copies only attached media, and relocates', t => {
  const { root, outputDir, report, attachments } = fixture(t);
  const source = join(root, 'clip.webm');
  writeFileSync(source, 'recording bytes');
  writeFileSync(join(root, 'credential.key'), 'private key');
  attachments.push({ name: 'Recording', contentType: 'video/webm', path: source });
  attachments.push({ name: 'raw diagnostics', contentType: 'text/plain', body: Buffer.from('secret-log') });
  writeReport(report, { outputDir, artifactRoots: [root] });
  const saved = readFileSync(join(outputDir, 'report.json'), 'utf8');
  assert.ok(!saved.includes(root) && !saved.includes('secret-log') && !saved.includes('"body"'));
  const html = readFileSync(join(outputDir, 'index.html'), 'utf8');
  assert.ok(html.includes('&lt;/script&gt;&lt;img'));
  assert.ok(!html.includes(report.runs[0].tests[0].title));
  const portable = JSON.parse(saved);
  const media = portable.runs[0].tests[0].attempts[0].attachments[0];
  const relocated = join(root, 'moved');
  renameSync(outputDir, relocated);
  assert.equal(readFileSync(join(relocated, media.path), 'utf8'), 'recording bytes');
  assert.equal(readdirSync(join(relocated, 'media')).length, 1);
});
test('missing and intentionally disabled recordings keep their test and result', t => {
  const { root, outputDir, report, attachments } = fixture(t);
  attachments.push({ name: 'expired', contentType: 'video/webm', path: join(root, 'missing.webm') });
  attachments.push({ name: 'disabled', contentType: 'video/webm', availability: 'disabled' });
  writeReport(report, { outputDir, artifactRoots: [root] });
  const html = readFileSync(join(outputDir, 'index.html'), 'utf8');
  assert.match(html, /Missing or expired recording/);
  assert.match(html, /Recording intentionally disabled/);
  assert.ok(!html.includes('<source'));
  assert.equal(JSON.parse(readFileSync(join(outputDir, 'report.json'))).runs[0].tests[0].outcome, 'failed');
});
test('unsafe attachments fail without exposing a partial output or replacing previous output', t => {
  const { root, outputDir, report, attachments } = fixture(t);
  writeReport(report, { outputDir });
  const previous = readFileSync(join(outputDir, 'report.json'), 'utf8');
  attachments.push({ name: 'escape', contentType: 'video/webm', path: join(root, '..', 'outside.webm') });
  assert.throws(() => writeReport(report, { outputDir, artifactRoots: [root] }), /escapes/);
  assert.equal(readFileSync(join(outputDir, 'report.json'), 'utf8'), previous);
  attachments[0].path = join(root, 'link.webm');
  writeFileSync(join(root, 'real.webm'), 'bytes');
  symlinkSync(join(root, 'real.webm'), attachments[0].path);
  assert.throws(() => writeReport(report, { outputDir, artifactRoots: [root] }), /symlink/);
  rmSync(outputDir, { recursive: true });
  assert.throws(() => writeReport(report, { outputDir, artifactRoots: [root] }), /symlink/);
  assert.ok(!existsSync(outputDir));
});
test('output ownership protects caller directories and permits repeat report generation', t => {
  const { root, outputDir, report } = fixture(t);
  mkdirSync(outputDir);
  writeFileSync(join(outputDir, 'keep.txt'), 'keep');
  assert.throws(() => writeReport(report, { outputDir }), /not owned/);
  assert.equal(readFileSync(join(outputDir, 'keep.txt'), 'utf8'), 'keep');
  const owned = join(root, 'owned');
  writeReport(report, { outputDir: owned });
  report.title = 'second run';
  writeReport(report, { outputDir: owned });
  assert.equal(JSON.parse(readFileSync(join(owned, 'report.json'))).title, 'second run');
});
test('merge namespaces runner/run/shard identities and preserves all attempts', t => {
  const { root, outputDir, report, attachments } = fixture(t);
  attachments.push({ name: 'image', contentType: 'image/png', body: Buffer.from('image bytes') });
  writeReport(report, { outputDir });
  const second = structuredClone(report);
  second.runs[0].shard = '2';
  second.runs[0].tests[0].attempts.push({ index: 1, status: 'passed', rawStatus: 'passed', durationMs: 1, steps: [], attachments: [] });
  second.runs[0].tests[0].outcome = outcome(second.runs[0].tests[0].attempts);
  const other = join(root, 'second');
  writeReport(second, { outputDir: other });
  const merged = join(root, 'merged');
  mergeReports([join(outputDir, 'report.json'), join(other, 'report.json')], { outputDir: merged });
  const saved = JSON.parse(readFileSync(join(merged, 'report.json')));
  assert.equal(saved.runs.length, 2);
  assert.equal(saved.runs[1].tests[0].outcome, 'flaky');
  assert.equal(saved.runs[1].tests[0].attempts.length, 2);
  assert.equal(readdirSync(join(merged, 'media')).length, 1);
  assert.throws(() => mergeReports([join(outputDir, 'report.json'), join(outputDir, 'report.json')], { outputDir: merged }), /Duplicate report run/);
});
test('merge rejects incompatible schemas, escaping paths, malformed attempts, and duplicate test IDs', t => {
  const { root, report } = fixture(t);
  const input = join(root, 'input.json');
  report.runs[0].tests[0].attempts[0].attachments.push({ name: 'bad', contentType: 'video/webm', path: '../escape.webm' });
  writeFileSync(input, JSON.stringify(report));
  assert.throws(() => mergeReports([input], { outputDir: join(root, 'out') }), /escapes/);
  report.schemaVersion = 99;
  assert.throws(() => validateReport(report), /schemaVersion/);
  report.schemaVersion = 1;
  report.runs[0].tests.push(structuredClone(report.runs[0].tests[0]));
  assert.throws(() => validateReport(report), /Duplicate test/);
  report.runs[0].tests.pop();
  report.runs[0].tests[0].attempts[0].durationMs = -1;
  assert.throws(() => validateReport(report), /number/);
});
test('empty and interrupted reports render even when no attempts completed', t => {
  const { outputDir, report } = fixture(t);
  report.runs[0].status = 'interrupted';
  report.runs[0].tests[0].attempts = [];
  report.runs[0].tests[0].outcome = 'unknown';
  writeReport(report, { outputDir });
  assert.match(readFileSync(join(outputDir, 'index.html'), 'utf8'), /No recording attached/);
  report.runs[0].tests = [];
  writeReport(report, { outputDir });
  assert.match(readFileSync(join(outputDir, 'index.html'), 'utf8'), /No tests match/);
});
test('portable serialization strips unknown diagnostic fields, including nested steps', t => {
  const { outputDir, report } = fixture(t);
  const testCase = report.runs[0].tests[0];
  testCase.location = { file: 'example.spec.ts', line: 1, privateSource: 'do-not-export' };
  testCase.attempts[0].steps = [{ title: 'outer', status: 'failed', durationMs: 1, error: 'do-not-export', steps: [{ title: 'inner', status: 'failed', durationMs: 1, stack: 'do-not-export' }] }];
  writeReport(report, { outputDir });
  assert.ok(!readFileSync(join(outputDir, 'report.json'), 'utf8').includes('do-not-export'));
});
