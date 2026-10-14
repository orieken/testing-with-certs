import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { ITestCaseHookParameter } from '@cucumber/cucumber';
import type { Browser, BrowserContextOptions } from '@playwright/test';
import { createCertificateCucumberHooks, type CertificateWorld, type CucumberIdentityOptions } from '../cucumber.js';

const ref = { namespace: 'lesson', name: 'student' };
const material = { ref, cert: '/identity/cert.pem', key: '/identity/key.pem', serial: '01', fingerprint256: 'AA', subject: 'CN=student', issuer: 'CN=CA', expiresAt: '2030-01-01T00:00:00Z' };
const target = { origins: ['https://shop.example.test:8443'], issuer: 'https://auth.example.test/realms/lesson' };

/** @issue OS browser recording matrix @ac Optional Cucumber video recording preserves certificate trust and selected identity. */
for (const recording of [false, true]) test(`Cucumber context preserves certificate trust with recording ${recording ? 'enabled' : 'disabled'}`, async () => {
  let received: BrowserContextOptions | undefined;
  let closed = 0;
  const page = {};
  const context = { newPage: async () => page, request: {}, close: async () => { closed++; } };
  const browser = { newContext: async (options: BrowserContextOptions) => { received = options; return context; } } as unknown as Browser;
  const options: CucumberIdentityOptions = {
    browser: () => browser,
    provider: { resolve: async () => material },
    target,
    resolveIdentity: () => ref,
    ...(recording ? { recordVideo: { dir: '/artifacts/videos', size: { width: 1280, height: 720 } } } : {})
  };
  // A JavaScript consumer cannot override trust or identity by passing extra context options.
  Object.assign(options, { ['ignoreHTTPSErrors']: Boolean(1), clientCertificates: [] });
  const hooks = createCertificateCucumberHooks(options);
  const world = { initializeManagers() {}, cleanupManagers: async () => {} } as unknown as CertificateWorld;
  await hooks.before.call(world, { pickle: { name: 'Certificate scenario' } } as ITestCaseHookParameter);
  assert.equal(received?.ignoreHTTPSErrors, false);
  assert.deepEqual(received?.clientCertificates, [{ origin: target.origins[0], certPath: '/identity/cert.pem', keyPath: '/identity/key.pem' }]);
  assert.deepEqual(received?.recordVideo, recording ? { dir: '/artifacts/videos', size: { width: 1280, height: 720 } } : undefined);
  assert.equal(world.page, page);
  await hooks.after.call(world);
  assert.equal(closed, 1);
  assert.equal(world.context, undefined);
});

/** @issue OS browser recording matrix @ac Failed scenario initialization closes the recording context. */
test('Cucumber closes the context when scenario initialization fails', async () => {
  let closed = 0;
  const hooks = createCertificateCucumberHooks({
    browser: () => ({ newContext: async () => ({ newPage: async () => { throw new Error('page failed'); }, close: async () => { closed++; } }) }) as unknown as Browser,
    provider: { resolve: async () => material },
    target, resolveIdentity: () => ref, recordVideo: { dir: '/artifacts/videos' }
  });
  await assert.rejects(hooks.before.call({} as CertificateWorld, { pickle: { name: 'Broken scenario' } } as ITestCaseHookParameter), /page failed/);
  assert.equal(closed, 1);
});

/** @issue OS browser recording matrix @ac Failed manager cleanup still flushes the recording context. */
test('Cucumber flushes videos by closing the context even when manager cleanup fails', async () => {
  let closed = 0;
  const hooks = createCertificateCucumberHooks({
    browser: () => ({} as Browser), provider: { resolve: async () => material }, target,
    resolveIdentity: () => ref, recordVideo: { dir: '/artifacts/videos' }
  });
  const world = {
    context: { close: async () => { closed++; } },
    cleanupManagers: async () => { throw new Error('cleanup failed'); }
  } as unknown as CertificateWorld;
  await assert.rejects(hooks.after.call(world), /cleanup failed/);
  assert.equal(closed, 1);
  assert.equal(world.context, undefined);
});
