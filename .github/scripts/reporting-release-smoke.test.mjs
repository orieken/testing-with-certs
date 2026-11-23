import assert from 'node:assert/strict';
import { test } from 'node:test';
import { names } from './reporting-release.mjs';
import { registry, validateRelease, waitForRelease, verifyInstalledLock, installFromRegistry } from './reporting-release-smoke-policy.mjs';

const version = '0.1.2';
function metadata() {
  return names.map((name, index) => ({ name: `@orieken/${name}`, version, dist: { integrity: `sha512-YWJj${index}` },
    ...(index ? { dependencies: { '@orieken/saturday-reporting': version }, peerDependencies: index === 1 ? { '@playwright/test': '1.65.1' } : { '@cucumber/cucumber': '12.9.0' } } : {}),
  }));
}
const plan = () => ({ version, packages: metadata().map(item => ({ name: item.name, version, integrity: item.dist.integrity })) });
function request(status = 200) {
  return async url => ({ status, json: async () => metadata().find(item => url.includes(encodeURIComponent(item.name))) });
}
function lock(cucumberOnly = false) {
  const packages = metadata().filter((_, index) => index === 0 || index === (cucumberOnly ? 2 : 1));
  return { packages: { '': {}, ...Object.fromEntries(packages.map(item => [`node_modules/${item.name}`, { version, resolved: `${registry}/${item.name}/package.tgz`, integrity: item.dist.integrity }])) } };
}

test('the exact release and peer versions come from published metadata, verified against the release plan', () => {
  const release = validateRelease(version, metadata(), plan());
  assert.equal(release.playwright, '1.65.1'); assert.equal(release.cucumber, '12.9.0');
  assert.throws(() => validateRelease('latest', metadata()), /exact release version/);
  const incorrect = plan(); incorrect.packages[1].integrity = 'sha512-other';
  assert.throws(() => validateRelease(version, metadata(), incorrect), /Published bytes differ/);
  const wrongCore = metadata(); wrongCore[2].dependencies['@orieken/saturday-reporting'] = '0.1.1';
  assert.throws(() => validateRelease(version, wrongCore));
  const wrongVersion = metadata(); wrongVersion[0].version = '0.1.1';
  assert.throws(() => validateRelease(version, wrongVersion));
});

test('npm propagation retries absent or temporarily unavailable versions, without changing the requested version', async () => {
  for (const status of [404, 408, 429, 503]) {
    let ready = false, pauses = 0;
    const release = await waitForRelease(version, plan(), {
      request: async url => request(ready ? 200 : status)(url),
      pause: async () => { ready = true; pauses++; }, log: () => {},
    });
    assert.equal(release.version, version); assert.equal(pauses, 1);
  }
});

test('transient fetch failures retry, but authorization and integrity failures fail immediately', async () => {
  let ready = false;
  await waitForRelease(version, plan(), { request: async url => {
    if (!ready) throw new TypeError('fetch failed');
    return request()(url);
  }, pause: async () => { ready = true; }, log: () => {} });
  const noRetry = async () => assert.fail('Permanent errors must not retry');
  await assert.rejects(waitForRelease(version, plan(), { request: request(403), pause: noRetry }), /Cannot inspect/);
  const wrong = plan(); wrong.packages[0].integrity = 'sha512-wrong';
  await assert.rejects(waitForRelease(version, wrong, { request: request(), pause: noRetry }), /Published bytes differ/);
});

test('registry propagation has a bounded deadline', async () => {
  let clock = 0;
  await assert.rejects(waitForRelease(version, undefined, {
    request: request(404), now: () => clock, timeoutMs: 20, intervalMs: 10,
    pause: async ms => { clock += ms; }, log: () => {},
  }), /Timed out waiting for npm propagation/);
  assert.equal(clock, 20);
});

test('stale npm install metadata retries within the same deadline, while permanent errors fail', async () => {
  let calls = 0, clock = 0;
  await installFromRegistry(() => ++calls === 1 ? { status: 1, stderr: 'npm error code ETARGET' } : { status: 0 }, {
    deadline: 20, now: () => clock, pause: async ms => { clock += ms; }, log: () => {},
  });
  assert.equal(calls, 2);
  await assert.rejects(installFromRegistry(() => ({ status: 1, stderr: 'npm error code ERESOLVE' }), {
    deadline: 20, now: () => 0, pause: async () => assert.fail('Dependency conflicts must not retry'),
  }), /Clean npm install failed/);
  await assert.rejects(installFromRegistry(() => ({ status: 1, stderr: 'npm error code E404' }), {
    deadline: 20, now: () => clock, pause: async ms => { clock += ms; }, log: () => {},
  }), /Clean npm install failed/);
});

test('consumer locks require npm bytes and reject local sources, missing adapters, and unexpected frameworks', () => {
  const release = validateRelease(version, metadata());
  assert.equal(verifyInstalledLock(lock(), release).length, 2);
  for (const mutation of [
    item => { item.resolved = 'file:../../local.tgz'; },
    item => { item.link = true; },
    item => { item.integrity = 'sha512-other'; },
    item => { item.version = '0.1.1'; },
  ]) {
    const sample = lock(); mutation(sample.packages['node_modules/@orieken/saturday-reporting']);
    assert.throws(() => verifyInstalledLock(sample, release));
  }
  const missing = lock(); delete missing.packages['node_modules/@orieken/saturday-playwright-reporter'];
  assert.throws(() => verifyInstalledLock(missing, release));
  const framework = lock(); framework.packages['node_modules/@orieken/saturday-core'] = { version, resolved: `${registry}/framework.tgz` };
  assert.throws(() => verifyInstalledLock(framework, release), /Unexpected Saturday framework/);
});

test('plain Cucumber must not acquire a Playwright dependency, including a nested one', () => {
  const release = validateRelease(version, metadata());
  assert.equal(verifyInstalledLock(lock(true), release, { cucumberOnly: true }).length, 2);
  for (const path of ['node_modules/@playwright/test', 'node_modules/playwright', 'node_modules/another/node_modules/playwright-core']) {
    const sample = lock(true); sample.packages[path] = { version: '1.65.1', resolved: `${registry}/browser.tgz` };
    assert.throws(() => verifyInstalledLock(sample, release, { cucumberOnly: true }), /must not install Playwright/);
  }
});
