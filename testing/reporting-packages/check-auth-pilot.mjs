import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mergeReports, validateReport } from '../../packages/saturday-reporting/dist/index.js';
import { checks } from '../reporting/password-results.mjs';
import { scanArtifacts } from '../container/check-artifacts.mjs';
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex');
function walk(root) {
  return readdirSync(root).flatMap(name => {
    const path = join(root, name), stat = lstatSync(path);
    assert.ok(!stat.isSymbolicLink(), 'Pilot evidence must not contain symlinks');
    return stat.isDirectory() ? walk(path) : [path];
  });
}
function caseName(test, runner) {
  if (runner === 'playwright') return test.title.replace(/^Certificate and password: /, '');
  const lines = readFileSync(new URL('../cucumber/features/certificate-password.feature', import.meta.url), 'utf8').split('\n');
  assert.ok(test.location?.file.endsWith('certificate-password.feature'), 'Unexpected feature');
  return lines[test.location.line - 1]?.match(/^\s*\|\s*([a-z-]+)\s*\|/)?.[1];
}
export async function comparePilot(root, legacy, secretValues = []) {
  root = resolve(root); legacy = resolve(legacy);
  const records = walk(join(legacy, 'recordings')).filter(path => path.endsWith('/recording.json')).map(read);
  assert.equal(records.length, 36, 'Every live case must have exactly one producer recording');
  const files = [], selections = [];
  for (const browser of ['chrome', 'msedge']) for (const runner of ['playwright', 'cucumber']) {
    const selection = `${browser}-${runner}`, source = join(root, selection, 'report.json');
    const report = read(source), original = read(join(legacy, selection, 'results.json'));
    validateReport(report);
    assert.equal(report.runs.length, 1);
    const run = report.runs[0];
    assert.equal(run.runner, runner); assert.equal(run.status, 'passed'); assert.equal(run.tests.length, 9);
    assert.equal(original.evidence, 'live-certificate-password'); assert.equal(original.runner, runner); assert.equal(original.browser, browser);
    assert.deepEqual(original.cases.map(c => c.kind).sort(), [...checks].sort());
    assert.deepEqual(run.tests.map(test => caseName(test, runner)).sort(), [...checks].sort());
    let videos = 0;
    for (const test of run.tests) {
      const kind = caseName(test, runner);
      assert.equal(original.cases.find(c => c.kind === kind).status, 'passed');
      assert.equal(test.outcome, 'passed'); assert.equal(test.attempts.length, 1);
      assert.equal(test.metadata.browser ?? run.metadata.browser, browser);
      const attempt = test.attempts[0];
      assert.equal(attempt.status, 'passed'); assert.equal(attempt.rawStatus.toLowerCase(), 'passed');
      assert.deepEqual(attempt.steps, [], 'Credential-sensitive runner step titles must be omitted');
      const matches = records.filter(r => r.browser === browser && r.runner === runner && r.name === kind);
      assert.equal(matches.length, 1);
      const record = matches[0];
      assert.equal(record.status, 'passed'); assert.equal(record.privacy, 'provider-document-hidden-before-paint');
      const media = attempt.attachments.filter(a => a.contentType === 'video/webm');
      assert.ok(media.length > 0, 'Every live case needs its own attached recording');
      assert.ok(media.every(a => a.availability === 'available' && /^media\/[a-f0-9]{64}\.webm$/.test(a.path)));
      assert.deepEqual(media.map(a => digest(join(root, selection, a.path))).sort(), record.videos.map(path => {
        const target = resolve(legacy, path);
        assert.ok(target.startsWith(`${legacy}/`), 'Producer recording escapes report root');
        return digest(target);
      }).sort(), 'Scenario/video association must match the producer receipt');
      videos += media.length;
    }
    files.push(source); selections.push({ browser, runner, cases: run.tests.length, videos });
  }
  mergeReports(files, { outputDir: join(root, 'report'), title: 'Saturday live certificate/password pilot' });
  for (const file of walk(root).filter(file => /\.(html|json|xml|txt)$/.test(file))) {
    const text = readFileSync(file, 'utf8');
    assert.ok(secretValues.every(secret => !text.includes(secret)), 'Fixture credential leaked into pilot text');
  }
  const scanned = await scanArtifacts(root, { requireMountedPath: false });
  await scanArtifacts(legacy, { requireMountedPath: false });
  return { status: 'passed', cases: 36, selections, scanned };
}
async function playback(root) {
  const { chromium } = await import('@playwright/test');
  const results = [];
  for (const browser of ['chrome', 'msedge']) {
    const instance = await chromium.launch({ channel: browser, headless: true });
    try {
      const page = await instance.newPage();
      await page.goto(pathToFileURL(join(root, 'report/index.html')).href);
      await page.locator('[data-filter="browser"]').selectOption(browser);
      for (const runner of ['playwright', 'cucumber']) {
        await page.locator('[data-filter="runner"]').selectOption(runner);
        assert.equal(await page.locator('#selection-stream > .video-card:visible').count(), 9);
        const videos = page.locator('#selection-stream video:visible');
        for (const video of await videos.all()) await video.evaluate(async item => {
          item.muted = true; await item.play();
          await new Promise((resolve, reject) => {
            if (item.currentTime > 0) return resolve();
            const timeout = setTimeout(() => reject(new Error('Pilot recording did not advance')), 10000);
            item.addEventListener('timeupdate', () => { if (item.currentTime > 0) { clearTimeout(timeout); resolve(); } });
          });
          item.pause();
        });
        results.push({ browser, runner, videos: await videos.count(), status: 'passed' });
      }
    } finally { await instance.close(); }
  }
  return results;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2]), legacy = resolve(process.argv[3]);
  const secrets = read('/test-secrets/passwords.json').map(entry => entry.password);
  const result = await comparePilot(root, legacy, secrets);
  result.playback = await playback(root);
  writeFileSync(join(root, 'verification.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
}
