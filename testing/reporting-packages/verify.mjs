import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packages, root, build } from './build.mjs';
import { runUnitTests } from './unit.mjs';
import { runUiTests } from './ui.mjs';
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const version = json(join(root, 'packages/saturday-reporting/package.json')).version;
const browser = process.argv.includes('--browser');
const destination = join(root, 'artifacts/saturday-reporting');
mkdirSync(destination, { recursive: true });
const temporary = mkdtempSync(join(realpathSync(tmpdir()), 'saturday-packages-'));
function run(command, args, cwd, expected = 0, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd, encoding: 'utf8', timeout: 180_000, maxBuffer: 10_000_000,
    env: { ...process.env, SATURDAY_EDGE_CASES: '', SATURDAY_BROWSER: '', SATURDAY_INTERRUPT: '', ...extraEnv, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' },
  });
  if (result.status !== expected) throw new Error(`${command} ${args.join(' ')} returned ${result.status}, expected ${expected}\n${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  if (expected !== 0 && !existsSync(join(cwd, 'saturday-report/report.json'))) throw new Error(`Runner failed before producing a report\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
function installExample(name, adapter, tarballs) {
  const directory = join(temporary, name);
  cpSync(join(root, `packages/${adapter}/examples/basic`), directory, { recursive: true });
  const manifest = json(join(directory, 'package.json'));
  manifest.devDependencies['@orieken/saturday-reporting'] = `file:${tarballs['saturday-reporting']}`;
  manifest.devDependencies[`@orieken/${adapter}`] = `file:${tarballs[adapter]}`;
  writeFileSync(join(directory, 'package.json'), JSON.stringify(manifest));
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', ...(process.env.SATURDAY_NPM_OFFLINE ? ['--offline'] : [])], directory);
  const installed = json(join(directory, 'node_modules', '@orieken', adapter, 'package.json'));
  assert.equal(installed.dependencies['@orieken/saturday-reporting'], version);
  mkdirSync(join(directory, 'test-results'), { recursive: true });
  return directory;
}
function playwrightBaseline(directory, report) {
  const baseline = json(join(directory, 'test-results/baseline.json'));
  const specs = [];
  function walk(suite) { specs.push(...(suite.specs ?? [])); (suite.suites ?? []).forEach(walk); }
  baseline.suites.forEach(walk);
  const actual = report.runs[0].tests;
  assert.equal(actual.length, specs.reduce((sum, spec) => sum + spec.tests.length, 0));
  for (const spec of specs) for (const test of spec.tests) {
    const saved = actual.find(item => item.id === spec.id);
    assert.ok(saved, `Missing Playwright test ${spec.title}`);
    assert.deepEqual(saved.attempts.map(a => a.rawStatus), test.results.map(a => a.status));
    assert.equal(saved.expectedStatus, test.expectedStatus);
  }
}
function cucumberBaseline(directory, report) {
  const envelopes = readFileSync(join(directory, 'test-results/messages.ndjson'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  const cases = new Map(envelopes.filter(e => e.testCase).map(e => [e.testCase.id, e.testCase.pickleId]));
  const starts = envelopes.filter(e => e.testCaseStarted).map(e => e.testCaseStarted);
  const actual = report.runs[0].tests;
  assert.equal(actual.length, new Set(starts.map(start => cases.get(start.testCaseId))).size);
  assert.equal(actual.flatMap(t => t.attempts).length, starts.length);
  const priorities = ['UNKNOWN', 'PASSED', 'SKIPPED', 'PENDING', 'UNDEFINED', 'AMBIGUOUS', 'FAILED'];
  for (const start of starts) {
    const statuses = envelopes.filter(e => e.testStepFinished?.testCaseStartedId === start.id).map(e => e.testStepFinished.testStepResult.status);
    const worst = statuses.sort((a, b) => priorities.indexOf(b) - priorities.indexOf(a))[0] ?? 'UNKNOWN';
    const test = actual.find(item => item.id === cases.get(start.testCaseId));
    assert.equal(test.attempts.find(a => a.index === start.attempt).rawStatus, worst);
  }
}
async function verifyInterruption(directory) {
  const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--grep', 'interrupt me'], {
    cwd: directory, env: { ...process.env, SATURDAY_EDGE_CASES: '', SATURDAY_BROWSER: '', SATURDAY_INTERRUPT: '1', FORCE_COLOR: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '', interrupted = false;
  const timeout = setTimeout(() => child.kill('SIGKILL'), 30000);
  child.stdout.on('data', chunk => {
    output += chunk;
    if (!interrupted && output.includes('SATURDAY_INTERRUPT_READY')) { interrupted = true; child.kill('SIGINT'); }
  });
  child.stderr.on('data', chunk => { output += chunk; });
  try {
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    assert.ok(interrupted && code !== 0, output);
    assert.equal(json(join(directory, 'saturday-report/report.json')).runs[0].status, 'interrupted');
  } finally { clearTimeout(timeout); }
}
function verifyDeclarations(directory) {
  const file = join(directory, 'consumer.mts');
  writeFileSync(file, `import { writeReport, mergeReports, type Report, type ReportOptions } from '@orieken/saturday-reporting';\nconst report: Report = { schemaVersion: 1, title: 'typed', runs: [] };\nconst options: ReportOptions = { metadata: { team: 'typed' } };\nwriteReport(report, options); mergeReports([], options);\n`);
  const require = createRequire(new URL('../../packages/saturday-reporting/package.json', import.meta.url));
  run(process.execPath, [require.resolve('typescript/bin/tsc'), '--strict', '--noEmit', '--skipLibCheck', '--module', 'NodeNext', '--target', 'ES2022', file], directory);
}
async function verifyBrowser(directory, pagePath) {
  const { chromium } = await import(join(directory, 'node_modules/@playwright/test/index.mjs'));
  const instance = await chromium.launch({ ...(process.env.SATURDAY_BROWSER_CHANNEL ? { channel: process.env.SATURDAY_BROWSER_CHANNEL } : {}) });
  try {
    const page = await instance.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(new URL(`file://${pagePath}`).href);
    const count = await page.locator('#selection-stream > .video-card').count();
    assert.ok(count > 0);
    await page.locator('[data-filter="runner"]').selectOption('cucumber');
    assert.ok(await page.locator('#selection-stream > .video-card:visible').count() > 0);
    await page.locator('#search').fill('hostile');
    assert.equal(await page.locator('#selection-stream > .video-card:visible').count(), 1);
    await page.locator('[data-view="inspector"]').click();
    assert.equal(await page.locator('#inspector-rail button').count(), 1);
    assert.equal(await page.evaluate(() => window.pwned), undefined);
    await page.locator('#search').fill('');
    await page.locator('[data-filter="runner"]').selectOption('');
    await page.locator('[data-view="heatmap"]').click();
    assert.ok(await page.locator('#heatmap-body tr').count() > 0);
    await page.locator('#theme-btn').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    await page.locator('[data-view="gallery"]').click();
    const videos = page.locator('#selection-stream video');
    assert.equal(await videos.count(), 2);
    for (const video of await videos.all()) {
      await video.evaluate(async item => {
        item.muted = true;
        await item.play();
        await new Promise((resolve, reject) => {
          if (item.currentTime > 0) return resolve();
          const timeout = setTimeout(() => reject(new Error('Video did not advance')), 10000);
          item.addEventListener('timeupdate', () => { if (item.currentTime > 0) { clearTimeout(timeout); resolve(); } });
        });
        item.pause();
      });
    }
    await page.locator('#selection-stream [data-speed="2"]').first().click();
    assert.equal(await videos.first().evaluate(item => item.playbackRate), 2);
    await page.locator('[data-theater]').first().click();
    assert.equal(await page.locator('#theater-modal').evaluate(item => item.open), true);
    await page.locator('#close-theater').click();
    assert.deepEqual(errors, []);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: join(destination, 'gallery.png'), fullPage: true });
    return count;
  } finally { await instance.close(); }
}
try {
  build();
  runUnitTests({ buildPackages: false });
  const tarballs = {};
  for (const name of packages) {
    run(process.env.SATURDAY_PNPM ?? 'pnpm', ['pack', '--pack-destination', temporary], join(root, 'packages', name));
    const file = join(temporary, `orieken-${name}-${version}.tgz`);
    const inventory = JSON.parse(run('npm', ['pack', '--dry-run', '--json', '--ignore-scripts', file], temporary))[0];
    assert.ok(inventory.files.some(f => f.path === 'dist/index.d.ts'));
    assert.ok(inventory.files.some(f => f.path === 'LICENSE'));
    assert.ok(!inventory.files.some(f => /node_modules|src\/|test\//.test(f.path)));
    if (name === 'saturday-reporting') assert.ok(inventory.files.some(f => f.path === 'dist/ui/gallery.js'));
    tarballs[name] = file;
    cpSync(file, join(destination, `orieken-${name}-${version}.tgz`));
  }
  const pw = installExample('playwright', 'saturday-playwright-reporter', tarballs);
  const cu = installExample('cucumber', 'saturday-cucumber-formatter', tarballs);
  verifyDeclarations(pw);
  const runnerEnv = { SATURDAY_EDGE_CASES: '1', ...(browser ? { SATURDAY_BROWSER: '1' } : {}) };
  run(process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], pw, 1, runnerEnv);
  run(process.execPath, ['node_modules/@cucumber/cucumber/bin/cucumber.js'], cu, 1, runnerEnv);
  const playwright = json(join(pw, 'saturday-report/report.json'));
  const cucumber = json(join(cu, 'saturday-report/report.json'));
  playwrightBaseline(pw, playwright); cucumberBaseline(cu, cucumber);
  assert.ok(playwright.runs[0].tests.some(test => test.outcome === 'flaky'));
  assert.ok(playwright.runs[0].tests.some(test => test.attempts.some(a => a.rawStatus === 'timedOut')));
  for (const status of ['FAILED', 'PENDING', 'UNDEFINED', 'AMBIGUOUS', 'SKIPPED']) assert.ok(cucumber.runs[0].tests.some(test => test.attempts.some(a => a.rawStatus === status)), status);
  assert.ok(cucumber.runs[0].tests.some(test => test.outcome === 'flaky'));
  const merged = join(destination, 'report');
  run(join(pw, 'node_modules/.bin/saturday-report'), ['merge', '--output', merged, join(pw, 'saturday-report/report.json'), join(cu, 'saturday-report/report.json')], pw);
  const contents = readFileSync(join(merged, 'report.json'), 'utf8');
  assert.ok(!contents.includes(temporary));
  assert.ok(!contents.includes('Raw failure detail'));
  const moved = join(temporary, 'relocated');
  cpSync(merged, moved, { recursive: true });
  const browserTests = browser ? await verifyBrowser(pw, join(moved, 'index.html')) : null;
  if (browser) runUiTests({ buildPackages: false });
  // The same installed packages must also work with ordinary successful runs.
  run(process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], pw);
  run(process.execPath, ['node_modules/@cucumber/cucumber/bin/cucumber.js'], cu);
  assert.equal(json(join(pw, 'saturday-report/report.json')).runs[0].status, 'passed');
  assert.equal(json(join(cu, 'saturday-report/report.json')).runs[0].status, 'passed');
  await verifyInterruption(pw);
  run(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--grep', '^no such test$', '--pass-with-no-tests'], pw);
  run(process.execPath, ['node_modules/@cucumber/cucumber/bin/cucumber.js', '--tags', '@not-selected'], cu);
  assert.equal(json(join(pw, 'saturday-report/report.json')).runs[0].tests.length, 0);
  assert.equal(json(join(cu, 'saturday-report/report.json')).runs[0].tests.length, 0);
  const summary = { node: process.version, playwright: '1.61.0', cucumber: '12.9.0', coreTests: 8, playwrightTests: playwright.runs[0].tests.length, cucumberTests: cucumber.runs[0].tests.length, browserTests, gracefulInterruption: true, emptyRuns: true, tarballs: packages.length };
  writeFileSync(join(destination, 'verification.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log('PASS: standalone tarball installs, runner baseline comparisons, retries, parallel execution, report merge, and successful reruns');
  console.log(JSON.stringify(summary));
} finally { rmSync(temporary, { recursive: true, force: true }); }
