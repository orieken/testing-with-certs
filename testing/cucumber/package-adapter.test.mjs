import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';

test('Cucumber index uses scenario identity and waits for browser closure', async () => {
  const source = (await readFile(new URL('./package-adapter.mjs', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '');
  const before = [], after = [], beforeAll = [], afterAll = [];
  let closed = false, written;
  const bindings = {
    relative,
    writeFile: async (path, data) => { written = { path, data: JSON.parse(data) }; },
    Before: hook => before.push(hook), After: hook => after.push(hook),
    BeforeAll: hook => beforeAll.push(hook), AfterAll: hook => afterAll.push(hook),
    Given() {}, When() {}, Then() {}, setDefaultTimeout() {}, installSaturdayWorld() {},
    FileCertificateProvider: class {}, installCertificateCucumberHooks() {}, expect() {},
    chromium: { launch: async () => ({ close: async () => { closed = true; } }) },
    process: { env: { LAB_USER: 'shop-admin', LAB_BROWSER: 'msedge', LAB_RUN_ID: 'fixture' } }
  };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  await new AsyncFunction(...Object.keys(bindings), source)(...Object.values(bindings));
  await beforeAll[0]();
  for (const [id, name, status] of [['b', 'Same scenario', 'FAILED'], ['a', 'Same scenario', 'PASSED']]) {
    const scenario = { testCaseStartedId: id, pickle: { name, uri: 'cucumber/features/teaching.feature' }, result: { status } };
    const world = { page: { video: () => ({ path: async () => {
      assert.equal(closed, true, 'video path read before close');
      return `/work/artifacts/teaching/fixture/videos/${id}.webm`;
    } }) } };
    before[0].call(world, scenario);
    after[0].call(world, scenario);
  }
  await afterAll[0]();
  assert.equal(written.path, '/work/artifacts/teaching/fixture/video-cases.json');
  assert.deepEqual(written.data.cases, [
    { path: 'videos/b.webm', name: 'Same scenario', spec: 'cucumber/features/teaching.feature', status: 'FAILED' },
    { path: 'videos/a.webm', name: 'Same scenario', spec: 'cucumber/features/teaching.feature', status: 'PASSED' }
  ]);
});
