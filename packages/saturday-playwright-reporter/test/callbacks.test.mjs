import assert from 'node:assert/strict';
import { beforeEach, mock, test } from 'node:test';
import * as core from '../../saturday-reporting/dist/index.js';

const writeReport = mock.fn();
mock.module(new URL('../../saturday-reporting/dist/index.js', import.meta.url), {
  namedExports: { ...core, writeReport },
});
const { default: Reporter } = await import('../dist/index.js');
beforeEach(() => { writeReport.mock.resetCalls(); writeReport.mock.mockImplementation(() => undefined); });

const end = (status = 'passed') => ({ status, startTime: new Date('2026-01-02T03:04:05Z'), duration: 42 });
const result = (status = 'passed', retry = 0) => ({ status, retry, duration: 10, steps: [], attachments: [] });
function specimen(overrides = {}, project = { name: 'desktop', use: { channel: 'msedge' }, metadata: {} }) {
  return {
    id: 'test-id', title: 'checks checkout', titlePath: () => ['', 'checkout.spec.mjs', 'checkout', 'checks checkout'],
    location: { file: '/project/tests/checkout.spec.mjs', line: 12 }, parent: { project: () => project },
    tags: [], annotations: [], expectedStatus: 'passed', results: [result()], outcome: () => 'expected', ...overrides,
  };
}
function begin(tests, options = {}, config = {}) {
  const reporter = new Reporter(options);
  reporter.onBegin({ rootDir: '/project', projects: [{ outputDir: '/project/results' }], metadata: {}, ...config }, { allTests: () => tests });
  return reporter;
}
function saved() {
  assert.equal(writeReport.mock.callCount(), 1, 'completion must write exactly one report');
  const [report, options] = writeReport.mock.calls[0].arguments;
  return { report, options, run: report.runs[0], testCase: report.runs[0].tests[0] };
}

test('onBegin defers writing; onEnd forwards run identity, metadata precedence, locations, and trusted artifact roots', async () => {
  const item = specimen({ tags: ['@ordinary', '@saturday:persona=tag'], annotations: [{ type: 'saturday', description: 'persona=annotation' }] }, {
    name: 'desktop', use: { channel: 'msedge', browserName: 'chromium' }, metadata: { saturday: { persona: 'project', team: 'project-team' } },
  });
  const reporter = begin([item], { runId: 'run-id', shard: 'custom-shard', title: 'Checkout', metadata: { team: 'explicit-team' }, artifactRoots: ['/external'] }, {
    shard: { current: 2 }, metadata: { saturday: { team: 'config-team', environment: 'staging' } },
  });
  assert.equal(reporter.printsToStdio(), false);
  assert.equal(writeReport.mock.callCount(), 0);
  assert.deepEqual(await reporter.onEnd(end()), {});
  const { report, run, testCase, options } = saved();
  assert.equal(report.schemaVersion, 1); assert.equal(report.title, 'Checkout');
  assert.deepEqual({ id: run.id, shard: run.shard, runner: run.runner, status: run.status, startedAt: run.startedAt, durationMs: run.durationMs }, {
    id: 'run-id', shard: 'custom-shard', runner: 'playwright', status: 'passed', startedAt: '2026-01-02T03:04:05.000Z', durationMs: 42,
  });
  assert.deepEqual(run.metadata, { team: 'explicit-team', environment: 'staging' });
  assert.deepEqual(testCase.location, { file: 'tests/checkout.spec.mjs', line: 12 });
  assert.deepEqual(testCase.suite, ['checkout.spec.mjs', 'checkout']);
  assert.deepEqual(testCase.metadata, { os: process.platform, project: 'desktop', browser: 'msedge', team: 'project-team', persona: 'annotation' });
  assert.deepEqual(options.artifactRoots, [process.cwd(), '/project', '/project/results', '/external']);
});

for (const [name, outcome, expectedStatus, results, expected] of [
  ['ordinary success', 'expected', 'passed', [result()], 'passed'],
  ['expected failure', 'expected', 'failed', [result('failed')], 'passed'],
  ['unexpected pass', 'unexpected', 'failed', [result()], 'failed'],
  ['retry succeeds', 'flaky', 'passed', [result('failed'), result('passed', 1)], 'flaky'],
  ['skipped test', 'skipped', 'skipped', [result('skipped')], 'skipped'],
  ['timeout', 'unexpected', 'passed', [result('timedOut')], 'timedOut'],
  ['interruption', 'unexpected', 'passed', [result('interrupted')], 'interrupted'],
  ['unfinished test', 'unexpected', 'passed', [], 'unknown'],
]) test(`onEnd preserves ${name} and its original attempts`, async () => {
  await begin([specimen({ outcome: () => outcome, expectedStatus, results })]).onEnd(end());
  const { testCase } = saved();
  assert.equal(testCase.outcome, expected); assert.equal(testCase.expectedStatus, expectedStatus);
  assert.deepEqual(testCase.attempts.map(a => [a.index, a.rawStatus]), results.map(r => [r.retry, r.status]));
});

test('onEnd maps nested steps and attachment bodies without copying runner diagnostics', async () => {
  const body = Buffer.from('image');
  const attempt = result('failed');
  attempt.duration = -1;
  attempt.steps = [{ title: 'outer', category: 'test.step', duration: 2, error: { message: 'private diagnostic' }, steps: [
    { title: 'inner', category: 'expect', duration: -5, steps: [] },
  ] }];
  attempt.attachments = [{ name: 'screenshot', contentType: 'image/png', body }, { name: 'video', contentType: 'video/webm', path: '/project/results/video.webm' }];
  attempt.stdout = ['private diagnostic'];
  await begin([specimen({ results: [attempt], outcome: () => 'unexpected' })]).onEnd(end('failed'));
  const { testCase } = saved();
  assert.equal(testCase.attempts[0].durationMs, 0);
  assert.deepEqual(testCase.attempts[0].steps, [{ title: 'outer', category: 'test.step', durationMs: 2, status: 'failed', steps: [
    { title: 'inner', category: 'expect', durationMs: 0, status: 'passed', steps: [] },
  ] }]);
  assert.equal(testCase.attempts[0].attachments[0].body, body);
  assert.equal(testCase.attempts[0].attachments[1].path, '/project/results/video.webm');
  assert.ok(!JSON.stringify(testCase).includes('private diagnostic'));
});

test('includeSteps:false removes steps without mutating Playwright results or dropping attachments', async () => {
  const attempt = result();
  attempt.steps = [{ title: 'fill sensitive value', category: 'pw:api', duration: 1, steps: [] }];
  attempt.attachments = [{ name: 'video', contentType: 'video/webm', path: '/project/results/clip.webm' }];
  await begin([specimen({ results: [attempt] })], { includeSteps: false }).onEnd(end());
  assert.deepEqual(saved().testCase.attempts[0].steps, []);
  assert.equal(saved().testCase.attempts[0].attachments.length, 1);
  assert.equal(attempt.steps[0].title, 'fill sensitive value');
});

test('disabled-recording labels add a placeholder only when no video is attached', async () => {
  const withVideo = result();
  withVideo.attachments = [{ name: 'video', contentType: 'video/webm', path: '/project/results/clip.webm' }];
  await begin([specimen({ tags: ['@saturday:recording=disabled'], results: [result('failed'), withVideo] })]).onEnd(end());
  const [missing, recorded] = saved().testCase.attempts;
  assert.deepEqual(missing.attachments, [{ name: 'Video', contentType: 'video/webm', availability: 'disabled' }]);
  assert.equal(recorded.attachments.length, 1); assert.equal(recorded.attachments[0].availability, undefined);
});

test('onEnd handles missing onBegin and assigns a fresh run identity to empty interrupted runs', async () => {
  const first = new Reporter();
  assert.deepEqual(await first.onEnd(end('interrupted')), {});
  const { run, report } = saved();
  assert.match(run.id, /^[0-9a-f-]{36}$/); assert.equal(run.shard, '1');
  assert.equal(run.status, 'interrupted'); assert.deepEqual(run.tests, []);
  assert.equal(report.title, 'Saturday Playwright report');
  writeReport.mock.resetCalls();
  await new Reporter().onEnd(end());
  assert.notEqual(saved().run.id, run.id);
});

test('onEnd derives shard and browser labels from runner configuration', async () => {
  await begin([specimen({}, { name: '', use: { browserName: 'firefox' }, metadata: {} })], {}, { shard: { current: 3 } }).onEnd(end());
  const { run, testCase } = saved();
  assert.equal(run.shard, '3'); assert.equal(testCase.metadata.browser, 'firefox');
  assert.equal(testCase.metadata.project, undefined);
});

for (const failure of [new Error('disk unavailable'), 'non-Error failure']) test(`onEnd fails the run when writing throws ${typeof failure}`, async t => {
  const log = t.mock.method(console, 'error', () => {});
  writeReport.mock.mockImplementation(() => { throw failure; });
  assert.deepEqual(await begin([]).onEnd(end()), { status: 'failed' });
  assert.equal(writeReport.mock.callCount(), 1);
  assert.deepEqual(log.mock.calls[0].arguments, ['Saturday report generation failed:', failure instanceof Error ? failure.message : 'Unknown error']);
});

test('invalid callback metadata fails completion before writing a misleading report', async t => {
  t.mock.method(console, 'error', () => {});
  assert.deepEqual(await begin([specimen()], { metadata: { invalid: 123 } }).onEnd(end()), { status: 'failed' });
  assert.equal(writeReport.mock.callCount(), 0);
});
