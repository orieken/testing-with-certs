import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync, readFileSync, existsSync, cpSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { registry, waitForRelease, verifyInstalledLock, installFromRegistry } from './reporting-release-smoke-policy.mjs';
import { writeBrowserCucumberFixture } from './reporting-release-smoke-cucumber-browser.mjs';
import { browserMediaReceipts } from './reporting-release-smoke-media.mjs';

const root = mkdtempSync(join(realpathSync(tmpdir()), 'saturday-npm-smoke-'));
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
const evidence = resolve(process.env.SATURDAY_SMOKE_OUTPUT ?? 'artifacts/saturday-npm-smoke');
mkdirSync(evidence, { recursive: true });
const plan = process.env.SATURDAY_SMOKE_RELEASE_PLAN ? JSON.parse(readFileSync(process.env.SATURDAY_SMOKE_RELEASE_PLAN, 'utf8')) : undefined;
const version = process.env.SATURDAY_SMOKE_VERSION || plan?.version || JSON.parse(readFileSync(new URL('../../packages/saturday-reporting/package.json', import.meta.url))).version;
writeFileSync(join(evidence, 'summary.json'), JSON.stringify({ status: 'running', version }) + '\n');
const registryDeadline = Date.now() + 600000;
const release = await waitForRelease(version, plan);
const pw = join(root, 'playwright-project'), cu = join(root, 'cucumber-project'), cb = join(root, 'cucumber-browser-project');
const projects = [
  { directory: pw, name: 'playwright', runner: 'playwright', count: 3, browser: true },
  { directory: cu, name: 'cucumber', runner: 'cucumber', count: 4, browser: false },
  { directory: cb, name: 'cucumber-browser', runner: 'cucumber', count: 3, browser: true },
];
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const write = (path, contents) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, contents); };
const manifest = (directory, name, dependencies) => write(join(directory, 'package.json'), JSON.stringify({ name, private: true, type: 'module', devDependencies: dependencies }, null, 2));
function run(directory, executable, args, expected = 0, extraEnv = {}, { allowFailure = false, timeoutMs = 240000 } = {}) {
  console.log(`RUN ${directory}: ${executable} ${args.join(' ')}`);
  const child = spawnSync(executable, args, { cwd: directory, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 5000000, env: { ...process.env, ...extraEnv } });
  console.log(child.stdout ?? '');
  if (child.stderr) console.log(child.stderr);
  const logDirectory = join(evidence, 'logs'); mkdirSync(logDirectory, { recursive: true });
  writeFileSync(join(logDirectory, `${++commandNumber}.log`), `${executable} ${args.join(' ')}\n${child.stdout ?? ''}\n${child.stderr ?? ''}`);
  if (!allowFailure) {
    assert.equal(child.error, undefined);
    assert.equal(child.status, expected, `Unexpected exit from ${executable}`);
  }
  return child;
}
let commandNumber = 0;
for (const { directory } of projects) assert.equal(existsSync(directory), false, 'Consumer directory must start empty');
const cache = join(root, 'npm-cache'), userConfig = join(root, 'npmrc');
assert.equal(existsSync(cache), false, 'npm cache must start empty');
writeFileSync(userConfig, '');
process.env.npm_config_cache = cache; process.env.npm_config_userconfig = userConfig;
process.env.npm_config_registry = registry;
process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1'; delete process.env.NODE_PATH;
manifest(pw, 'npm-playwright-smoke', { '@playwright/test': release.playwright, '@orieken/saturday-playwright-reporter': version, '@orieken/saturday-reporting': version });
manifest(cu, 'npm-cucumber-smoke', { '@cucumber/cucumber': release.cucumber, '@orieken/saturday-cucumber-formatter': version });
manifest(cb, 'npm-cucumber-browser-smoke', { '@cucumber/cucumber': release.cucumber, '@orieken/saturday-cucumber-formatter': version, playwright: release.playwright });
for (const { directory } of projects) await installFromRegistry(() => run(directory, 'npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--prefer-online', '--registry', registry], 0, {}, { allowFailure: true }), { deadline: registryDeadline });

const installations = [];
for (const { directory, name } of projects) {
  const lock = json(join(directory, 'package-lock.json'));
  installations.push(...verifyInstalledLock(lock, release, { consumer: name }).map(item => ({ project: directory.split('/').at(-1), ...item })));
  assert.equal(existsSync(join(directory, 'node_modules/@orieken/saturday-core')), false);
  run(directory, 'npm', ['ls', '--depth=0']);
  cpSync(join(directory, 'package.json'), join(evidence, directory.split('/').at(-1) + '-package.json'));
  cpSync(join(directory, 'package-lock.json'), join(evidence, directory.split('/').at(-1) + '-package-lock.json'));
}
assert.equal(existsSync(join(cu, 'node_modules/@playwright')), false, 'Cucumber formatter must work without Playwright');
if (process.env.SATURDAY_SMOKE_SKIP_BROWSER_INSTALL !== '1') run(pw, 'node', ['node_modules/@playwright/test/cli.js', 'install', '--with-deps', 'chromium'], 0, {}, { timeoutMs: 600000 });

write(join(pw, 'playwright.config.mjs'), `import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',workers:1,retries:1,timeout:20000,
 reporter:[['list'],['@orieken/saturday-playwright-reporter',{outputDir:process.env.SMOKE_REPORT??'saturday-report',title:'Published Playwright ${version} smoke',metadata:{team:'npm-smoke'}}]],
 use:{headless:true,video:'on',screenshot:'on'}});
`);
write(join(pw, 'tests/smoke.spec.mjs'), `import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.setContent('<title>npm consumer</title><h1>Published package smoke</h1><button>Confirm</button>');});
test('Browser passes with a screenshot',async({page})=>{await expect(page.locator('h1')).toHaveText('Published package smoke');});
test('Browser retry is reported as flaky',async({page},info)=>{await page.getByRole('button',{name:'Confirm'}).click();if(!info.retry)throw new Error('SMOKE_RAW_PRIVATE_ERROR');});
test('Browser deliberate failure is preserved',async()=>{throw new Error('SMOKE_RAW_PRIVATE_ERROR');});
`);
write(join(cu, 'cucumber.mjs'), `export default {import:['features/steps.mjs'],retry:1,format:['progress','@orieken/saturday-cucumber-formatter:saturday-formatter.log'],formatOptions:{saturday:{outputDir:process.env.SMOKE_REPORT??'saturday-report',title:'Published Cucumber ${version} smoke',metadata:{team:'npm-smoke'}}}};
`);
write(join(cu, 'features/smoke.feature'), `Feature: Published npm formatter
  Scenario Outline: Plain Cucumber passes <value>
    Given a successful value "<value>"
    Then a PNG attachment is recorded
    Examples:
      | value |
      | alpha |
      | beta  |
  Scenario: Plain Cucumber retry is reported as flaky
    Given a step that passes on retry
  Scenario: Plain Cucumber deliberate failure is preserved
    Given a deliberately failing step
`);
write(join(cu, 'features/steps.mjs'), `import {Given,Then} from '@cucumber/cucumber';
import assert from 'node:assert/strict';
let attempts=0;
Given('a successful value {string}',function(value){assert.ok(['alpha','beta'].includes(value));});
Then('a PNG attachment is recorded',async function(){await this.attach(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'),{mediaType:'image/png',fileName:'Published PNG'});});
Given('a step that passes on retry',function(){assert.ok(++attempts>1,'SMOKE_RAW_PRIVATE_ERROR');});
Given('a deliberately failing step',function(){throw new Error('SMOKE_RAW_PRIVATE_ERROR');});
`);
writeBrowserCucumberFixture(cb, version);
for (const { directory } of projects) {
  const destination = join(evidence, 'consumers', directory.split('/').at(-1));
  mkdirSync(destination, { recursive: true });
  for (const name of directory === pw ? ['package.json','package-lock.json','playwright.config.mjs','tests'] : ['package.json','package-lock.json','cucumber.mjs','features']) {
    cpSync(join(directory, name), join(destination, name), { recursive: true });
  }
}

run(pw, 'node', ['node_modules/@playwright/test/cli.js', 'test'], 1);
run(cu, 'node', ['node_modules/@cucumber/cucumber/bin/cucumber.js'], 1);
run(cb, 'node', ['node_modules/@cucumber/cucumber/bin/cucumber.js'], 1);
const reports = [], mediaByRun = new Map();
for (const { directory, name, runner, count, browser } of projects) {
  const reportDirectory = join(directory, 'saturday-report');
  const content = readFileSync(join(reportDirectory, 'report.json'), 'utf8');
  assert.equal(content.includes('SMOKE_RAW_PRIVATE_ERROR'), false, 'Raw errors must not enter portable reports');
  const report = JSON.parse(content), run = report.runs[0];
  assert.equal(run.runner, runner); assert.equal(run.status, 'failed'); assert.equal(run.tests.length, count);
  const expected = runner === 'playwright' ? {
    'Browser passes with a screenshot': 'passed', 'Browser retry is reported as flaky': 'flaky', 'Browser deliberate failure is preserved': 'failed',
  } : directory === cb ? {
    'Browser Cucumber passes with real media': 'passed', 'Browser Cucumber retry is reported as flaky': 'flaky', 'Browser Cucumber deliberate failure is preserved': 'failed',
  } : {
    'Plain Cucumber passes alpha': 'passed', 'Plain Cucumber passes beta': 'passed', 'Plain Cucumber retry is reported as flaky': 'flaky', 'Plain Cucumber deliberate failure is preserved': 'failed',
  };
  assert.equal(new Set(run.tests.map(test => test.title)).size, count);
  for (const test of run.tests) assert.equal(test.outcome, expected[test.title], `Wrong outcome for ${test.title}`);
  const flaky = run.tests.find(test => test.outcome === 'flaky');
  assert.ok(flaky); assert.equal(flaky.attempts.length, 2);
  assert.equal(flaky.attempts[0].status, 'failed'); assert.equal(flaky.attempts[1].status, 'passed');
  assert.ok(run.tests.some(test => test.outcome === 'passed')); assert.ok(run.tests.some(test => test.outcome === 'failed'));
  const attachments = run.tests.flatMap(test => test.attempts.flatMap(attempt => attempt.attachments ?? []));
  assert.ok(attachments.some(item => item.contentType === 'image/png'));
  if (browser) {
    const receipts = browserMediaReceipts(reportDirectory, run.tests);
    assert.equal(receipts.length, 5, 'Every browser attempt must retain its screenshot and recording');
    mediaByRun.set(run.id, receipts);
    if (directory === cb) {
      const producer = json(join(cb, 'test-results/producer-media.json')).sort((a,b) => a.title.localeCompare(b.title) || a.attempt-b.attempt);
      assert.deepEqual(receipts, producer, 'Cucumber media must match the exact producer scenario and attempt');
      writeFileSync(join(evidence,'cucumber-browser-producer-media.json'),JSON.stringify(producer,null,2)+'\n');
    }
  }
  for (const item of attachments) if (item.path) assert.ok(existsSync(resolve(reportDirectory, item.path)));
  cpSync(reportDirectory, join(evidence, name), { recursive: true });
  reports.push({ report: name, runner, tests: run.tests.length, outcomes: run.tests.map(test=>test.outcome), attachments: attachments.length, browser });
}
run(pw, 'node', ['node_modules/@playwright/test/cli.js', 'test', '--grep', 'Browser passes'], 0, {SMOKE_REPORT:'happy-report'});
run(cu, 'node', ['node_modules/@cucumber/cucumber/bin/cucumber.js', '--name', 'Plain Cucumber passes'], 0, {SMOKE_REPORT:'happy-report'});
run(cb, 'node', ['node_modules/@cucumber/cucumber/bin/cucumber.js', '--name', '^Browser Cucumber passes'], 0, {SMOKE_REPORT:'happy-report'});
for (const { directory, name, browser } of projects) {
  const report = json(join(directory,'happy-report/report.json'));
  assert.equal(report.runs[0].status,'passed');
  if (browser) browserMediaReceipts(join(directory,'happy-report'),report.runs[0].tests);
  cpSync(join(directory,'happy-report'),join(evidence,name+'-happy'),{recursive:true});
}
run(pw, join(pw,'node_modules/.bin/saturday-report'), ['merge','--output',join(evidence,'merged'),...projects.map(project=>join(evidence,project.name,'report.json'))]);
const merged = json(join(evidence,'merged/report.json'));
assert.equal(merged.runs.length,3);
for (const [id, receipts] of mediaByRun) assert.deepEqual(browserMediaReceipts(join(evidence,'merged'),merged.runs.find(run=>run.id===id).tests),receipts,'Merged browser media must preserve bytes and attempt ownership');

const {chromium} = await import(pathToFileURL(join(pw,'node_modules/playwright/index.mjs')).href);
const browser = await chromium.launch({headless:true});
const ui = [];
try {
  for (const [name,count,recordings] of [['playwright',3,5],['cucumber',4,0],['cucumber-browser',3,5],['merged',10,10]]) {
    const page = await browser.newPage(), errors=[], network=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(/^https?:/.test(request.url()))network.push(request.url());});
    await page.goto(pathToFileURL(join(evidence,name,'index.html')).href);
    await page.locator('#shown').waitFor();
    assert.equal(await page.locator('#shown').innerText(),count+' / '+count+' tests');
    for (const label of ['Heatmap & triage','Split inspector','Visual gallery']) await page.getByRole('button',{name:label,exact:true}).click();
    await page.getByRole('button',{name:'Toggle theme'}).click();
    const images = await page.locator('#selection-stream img').evaluateAll(async elements=>Promise.all(elements.map(async image=>{await image.decode();return {width:image.naturalWidth,height:image.naturalHeight};})));
    assert.ok(images.every(image=>image.width>0&&image.height>0));
    if(name==='cucumber-browser') assert.ok(images.length===5&&images.every(image=>image.width===640&&image.height===360));
    const videos = page.locator('#selection-stream video');
    assert.equal(await videos.count(),recordings);
    for (const video of await videos.all()) {
      const dimensions = await video.evaluate(async element=>{
        element.muted=true;await element.play();
        await new Promise((resolve,reject)=>{
          if(element.ended)return resolve();
          const timer=setTimeout(()=>reject(new Error('Recording did not finish')),15000);
          element.addEventListener('ended',()=>{clearTimeout(timer);resolve();},{once:true});
          element.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Recording decode failed'));},{once:true});
        });
        return {width:element.videoWidth,height:element.videoHeight,duration:element.duration,time:element.currentTime,ended:element.ended,error:element.error?.message??null};
      });
      assert.ok(dimensions.width>0&&dimensions.height>0&&dimensions.duration>0&&dimensions.time>0&&dimensions.ended&&!dimensions.error);
      if(name==='cucumber-browser') assert.deepEqual([dimensions.width,dimensions.height],[640,360]);
    }
    await page.screenshot({path:join(evidence,name+'-smoke.png'),fullPage:true,animations:'disabled'});
    assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
    ui.push({report:name,tests:count,offline:true,pageErrors:0,playback:recordings>0,videosPlayed:recordings,imagesDecoded:images.length});
    await page.close();
  }
} finally { await browser.close(); }
const summary = {status:'passed',node:process.version,registry,version,playwright:release.playwright,cucumber:release.cucumber,releasePlanVerified:Boolean(plan),installations,reports,ui,happyRuns:true,cucumberWithoutPlaywright:true,cucumberBrowserMediaVerified:true,deliberateFailuresVerified:true};
writeFileSync(join(evidence,'summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(`PASS: published npm ${version} consumer smoke tests`);
console.log(JSON.stringify(summary));
