import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { beforeEach, mock, test } from 'node:test';
import * as core from '../../saturday-reporting/dist/index.js';

const writeReport = mock.fn();
mock.module(new URL('../../saturday-reporting/dist/index.js', import.meta.url), {
  namedExports: { ...core, writeReport },
});
const { default: Formatter } = await import('../dist/index.js');
beforeEach(() => { writeReport.mock.resetCalls(); writeReport.mock.mockImplementation(() => undefined); });

function attempt({ id = 'row-a', row = 12, index = 0, status = 'PASSED' } = {}) {
  return {
    attempt: index,
    pickle: { id, name: 'An outline row', uri: 'features/checkout.feature', astNodeIds: ['scenario', id], tags: [{ name: '@saturday:persona=customer' }], steps: [{ id: 'pickle-step', text: 'the order is accepted' }] },
    gherkinDocument: { feature: { name: 'Checkout', children: [{ scenario: {
      id: 'scenario', location: { line: 3 }, examples: [{ tableBody: [{ id, location: { line: row } }] }],
    } }] } },
    worstTestStepResult: { status, message: 'private diagnostic' },
    testCase: { testSteps: [{ id: 'hook' }, { id: 'step', pickleStepId: 'pickle-step' }, { id: 'unfinished' }] },
    stepResults: { hook: { status: 'PASSED', duration: { seconds: 0, nanos: 250_000_000 } }, step: { status, duration: { seconds: 1, nanos: 500_000_000 }, message: 'private diagnostic' } },
    stepAttachments: {},
  };
}
function fixture({ attempts = [], options = {}, pickles = {}, cleanup = mock.fn(async () => {}) } = {}) {
  const eventBroadcaster = new EventEmitter();
  const collector = { getTestCaseAttempts: mock.fn(() => attempts), getPickle: mock.fn(id => pickles[id]) };
  const formatter = new Formatter({ cwd: '/project', eventBroadcaster, eventDataCollector: collector, parsedArgvOptions: { saturday: options }, cleanup });
  return { formatter, collector, cleanup, emit: envelope => eventBroadcaster.emit('envelope', envelope) };
}
function saved() {
  assert.equal(writeReport.mock.callCount(), 1, 'finished must write exactly one report');
  const [report, options] = writeReport.mock.calls[0].arguments;
  return { report, options, run: report.runs[0], testCase: report.runs[0].tests[0] };
}
function cleanupGate() {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  return { cleanup: mock.fn(() => pending), release };
}
async function assertPending(promise) {
  let settled = false;
  promise.then(() => { settled = true; }, () => { settled = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false, 'formatter completion must wait for cleanup');
}

for (const success of [true, false]) test(`envelope callbacks capture run start and ${success ? 'successful' : 'failed'} completion without rendering early`, async () => {
  const f = fixture({ options: { runId: 'run-id', shard: 'shard-2', title: 'Acceptance', metadata: { team: 'checkout' }, artifactRoots: ['/external'] } });
  f.emit({ testRunStarted: { timestamp: { seconds: 1_700_000_000, nanos: 123_000_000 } } });
  f.emit({ testRunFinished: { success } });
  assert.equal(writeReport.mock.callCount(), 0);
  await f.formatter.finished();
  const { run, report, options } = saved();
  assert.equal(report.title, 'Acceptance'); assert.equal(report.schemaVersion, 1);
  assert.equal(run.id, 'run-id'); assert.equal(run.shard, 'shard-2'); assert.equal(run.runner, 'cucumber');
  assert.equal(run.startedAt, '2023-11-14T22:13:20.123Z'); assert.equal(run.status, success ? 'passed' : 'failed');
  assert.deepEqual(run.metadata, { os: process.platform, team: 'checkout' });
  assert.deepEqual(options.artifactRoots, ['/project', '/external']);
  assert.equal(f.cleanup.mock.callCount(), 1);
});

test('finished groups out-of-order retries by pickle identity while preserving separate outline rows', async () => {
  const f = fixture({ attempts: [attempt({ index: 1 }), attempt({ id: 'row-b', row: 13 }), attempt({ status: 'FAILED' })] });
  for (const pickleId of ['row-a', 'row-b']) f.emit({ testCase: { pickleId } });
  await f.formatter.finished();
  const { run } = saved();
  assert.equal(run.tests.length, 2);
  const [first, second] = run.tests;
  assert.equal(first.title, second.title); assert.notEqual(first.id, second.id);
  assert.deepEqual(first.location, { file: 'features/checkout.feature', line: 12 });
  assert.deepEqual(second.location, { file: 'features/checkout.feature', line: 13 });
  assert.deepEqual(first.suite, ['Checkout']); assert.deepEqual(first.metadata, { persona: 'customer' });
  assert.equal(first.outcome, 'flaky'); assert.equal(second.outcome, 'passed');
  assert.deepEqual(first.attempts.map(a => [a.index, a.rawStatus]), [[0, 'FAILED'], [1, 'PASSED']]);
  assert.equal(run.durationMs, 5250);
});

for (const [raw, normalized] of [['PASSED', 'passed'], ['FAILED', 'failed'], ['PENDING', 'pending'], ['UNDEFINED', 'undefined'], ['AMBIGUOUS', 'ambiguous'], ['SKIPPED', 'skipped'], ['UNKNOWN', 'unknown']]) {
  test(`finished preserves ${raw} while normalizing portable statuses`, async () => {
    await fixture({ attempts: [attempt({ status: raw })] }).formatter.finished();
    const { testCase } = saved();
    assert.equal(testCase.outcome, normalized);
    assert.equal(testCase.attempts[0].rawStatus, raw); assert.equal(testCase.attempts[0].status, normalized);
  });
}

test('finished converts nanosecond durations and distinguishes hooks, Gherkin steps, and unfinished steps', async () => {
  await fixture({ attempts: [attempt({ status: 'FAILED' })] }).formatter.finished();
  const { testCase } = saved();
  assert.equal(testCase.attempts[0].durationMs, 1750);
  assert.deepEqual(testCase.attempts[0].steps, [
    { title: 'Hook', category: 'hook', status: 'passed', durationMs: 250 },
    { title: 'the order is accepted', category: 'step', status: 'failed', durationMs: 1500 },
    { title: 'Hook', category: 'hook', status: 'unknown', durationMs: 0 },
  ]);
  assert.ok(!JSON.stringify(testCase).includes('private diagnostic'));
});

test('finished decodes base64 and identity attachments with their names and media types', async () => {
  const item = attempt();
  item.stepAttachments = {
    step: [{ fileName: 'Screenshot', mediaType: 'image/png', contentEncoding: 'BASE64', body: Buffer.from([0, 255, 42]).toString('base64') }],
    hook: [{ mediaType: 'text/plain', contentEncoding: 'IDENTITY', body: 'attachment text' }],
  };
  await fixture({ attempts: [item] }).formatter.finished();
  assert.deepEqual(saved().testCase.attempts[0].attachments, [
    { name: 'Screenshot', contentType: 'image/png', body: Buffer.from([0, 255, 42]) },
    { name: 'text/plain', contentType: 'text/plain', body: Buffer.from('attachment text') },
  ]);
});

test('includeSteps:false omits collected step text without changing input attempts or attachments', async () => {
  const item = attempt();
  item.pickle.steps[0].text = 'a sensitive input value';
  item.stepAttachments = { step: [{ mediaType: 'video/webm', contentEncoding: 'BASE64', body: Buffer.from('clip').toString('base64') }] };
  await fixture({ attempts: [item], options: { includeSteps: false } }).formatter.finished();
  const { testCase } = saved();
  assert.deepEqual(testCase.attempts[0].steps, []); assert.equal(testCase.attempts[0].attachments.length, 1);
  assert.equal(item.pickle.steps[0].text, 'a sensitive input value');
});

test('recording-disabled tags add placeholders without duplicating existing recordings', async () => {
  const missing = attempt({ status: 'FAILED' }), recorded = attempt({ index: 1 });
  for (const item of [missing, recorded]) item.pickle.tags.push({ name: '@saturday:recording=disabled' });
  recorded.stepAttachments = { step: [{ fileName: 'Clip', mediaType: 'video/webm', contentEncoding: 'BASE64', body: Buffer.from('clip').toString('base64') }] };
  await fixture({ attempts: [recorded, missing] }).formatter.finished();
  const [first, second] = saved().testCase.attempts;
  assert.deepEqual(first.attachments, [{ name: 'Video', contentType: 'video/webm', availability: 'disabled' }]);
  assert.equal(second.attachments.length, 1); assert.equal(second.attachments[0].name, 'Clip');
});

test('planned but unstarted cases are retained once, while completed cases are not duplicated', async () => {
  const pending = { id: 'pending', name: 'Not started', uri: 'features/checkout.feature', tags: [{ name: '@saturday:persona=guest' }] };
  const f = fixture({ attempts: [attempt()], pickles: { pending } });
  for (const pickleId of ['row-a', 'pending', 'pending']) f.emit({ testCase: { pickleId } });
  await f.formatter.finished();
  const { run } = saved();
  assert.equal(run.tests.length, 2);
  assert.deepEqual(run.tests[1], { id: 'pending', title: 'Not started', suite: ['features/checkout.feature'], metadata: { persona: 'guest' }, outcome: 'unknown', attempts: [] });
  assert.deepEqual(f.collector.getPickle.mock.calls.map(call => call.arguments), [['pending']]);
});

test('finished supports an empty run without start or finish envelopes and awaits superclass cleanup', async () => {
  const { cleanup, release } = cleanupGate();
  const completion = fixture({ cleanup }).formatter.finished();
  try { await assertPending(completion); } finally { release(); }
  await completion;
  const { run, report } = saved();
  assert.match(run.id, /^[0-9a-f-]{36}$/); assert.equal(run.shard, '1');
  assert.equal(run.status, 'unknown'); assert.equal(run.startedAt, undefined); assert.equal(run.durationMs, 0);
  assert.deepEqual(run.tests, []); assert.equal(report.title, 'Saturday Cucumber report');
  assert.equal(cleanup.mock.callCount(), 1);
});

for (const phase of ['collection', 'writing']) test(`finished propagates ${phase} failures and still awaits cleanup`, async () => {
  const failure = new Error(`${phase} unavailable`);
  const { cleanup, release } = cleanupGate();
  const f = fixture({ cleanup });
  if (phase === 'collection') f.collector.getTestCaseAttempts.mock.mockImplementation(() => { throw failure; });
  else writeReport.mock.mockImplementation(() => { throw failure; });
  const completion = f.formatter.finished();
  try { await assertPending(completion); } finally { release(); }
  await assert.rejects(completion, error => error === failure);
  assert.equal(f.cleanup.mock.callCount(), 1);
  assert.equal(writeReport.mock.callCount(), phase === 'collection' ? 0 : 1);
});
