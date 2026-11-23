import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { names } from './reporting-release.mjs';

export const registry = 'https://registry.npmjs.org';
export const exactVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
class RegistryPending extends Error {}

export function validateRelease(version, manifests, plan) {
  assert.match(version, exactVersion, 'An exact release version is required');
  assert.equal(manifests.length, names.length);
  if (plan) {
    assert.equal(plan.version, version, 'Release plan version mismatch');
    assert.deepEqual(plan.packages.map(item => item.name).sort(), names.map(name => `@orieken/${name}`).sort());
  }
  const packages = manifests.map((manifest, index) => {
    const name = `@orieken/${names[index]}`;
    assert.equal(manifest.name, name); assert.equal(manifest.version, version);
    assert.match(manifest.dist?.integrity ?? '', /^sha512-[A-Za-z0-9+/]+={0,2}$/);
    if (index > 0) assert.equal(manifest.dependencies?.['@orieken/saturday-reporting'], version);
    if (plan) {
      const expected = plan.packages.find(item => item.name === name);
      assert.equal(expected.version, version);
      assert.equal(manifest.dist.integrity, expected.integrity, `Published bytes differ from the release plan: ${name}`);
    }
    return { name, version, integrity: manifest.dist.integrity };
  });
  const playwright = manifests[1].peerDependencies?.['@playwright/test'];
  const cucumber = manifests[2].peerDependencies?.['@cucumber/cucumber'];
  assert.match(playwright ?? '', exactVersion, 'Playwright peer must be an exact version');
  assert.match(cucumber ?? '', exactVersion, 'Cucumber peer must be an exact version');
  return { version, playwright, cucumber, packages };
}

async function fetchMetadata(name, version, request) {
  let response;
  try {
    response = await request(`${registry}/${encodeURIComponent(name)}/${version}`, { signal: AbortSignal.timeout(15000), headers: { 'Cache-Control': 'no-cache' } });
  } catch (error) {
    if (['TypeError', 'TimeoutError', 'AbortError'].includes(error.name)) throw new RegistryPending(`Registry temporarily unreachable for ${name}`);
    throw error;
  }
  if ([404, 408, 429].includes(response.status) || response.status >= 500) throw new RegistryPending(`${name}@${version}: HTTP ${response.status}`);
  assert.equal(response.status, 200, `Cannot inspect published ${name}`);
  return response.json();
}

export async function waitForRelease(version, plan, {
  request = fetch, pause = delay, now = Date.now, timeoutMs = 600000, intervalMs = 10000, log = console.log,
} = {}) {
  assert.match(version, exactVersion, 'An exact release version is required');
  const deadline = now() + timeoutMs;
  while (true) {
    try {
      const manifests = await Promise.all(names.map(name => fetchMetadata(`@orieken/${name}`, version, request)));
      return validateRelease(version, manifests, plan);
    } catch (error) {
      if (!(error instanceof RegistryPending)) throw error;
      const remaining = deadline - now();
      if (remaining <= 0) throw new Error(`Timed out waiting for npm propagation: ${error.message}`);
      log(`Waiting for npm propagation: ${error.message}`);
      await pause(Math.min(intervalMs, remaining));
    }
  }
}

export async function installFromRegistry(execute, { deadline, pause = delay, now = Date.now, log = console.log } = {}) {
  assert.ok(Number.isFinite(deadline), 'An npm install retry deadline is required');
  while (true) {
    const result = execute();
    if (result.status === 0 && !result.error) return;
    const transient = /npm (?:error|ERR!) code (?:ETARGET|E404|E408|E429|E5\d\d|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ECONNREFUSED)\b/.test(result.stderr ?? '');
    const remaining = deadline - now();
    if (result.error || !transient || remaining <= 0) throw result.error ?? new Error(`Clean npm install failed with status ${result.status}`);
    log('Retrying the exact npm install while registry metadata propagates');
    await pause(Math.min(10000, remaining));
  }
}

export function verifyInstalledLock(lock, release, { cucumberOnly = false } = {}) {
  const installed = [];
  for (const [path, item] of Object.entries(lock.packages)) {
    if (!path) continue;
    assert.equal(item.link, undefined, `Unexpected package link: ${path}`);
    assert.ok(item.resolved?.startsWith(`${registry}/`), `Non-registry dependency: ${path}`);
    if (cucumberOnly) assert.ok(!/node_modules\/(?:@playwright\/|playwright(?:-core)?$)/.test(path), 'Plain Cucumber must not install Playwright');
    if (!path.includes('node_modules/@orieken/')) continue;
    const name = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
    const expected = release.packages.find(item => item.name === name);
    assert.ok(expected, `Unexpected Saturday framework package: ${name}`);
    assert.equal(item.version, release.version);
    assert.equal(item.integrity, expected.integrity, `Installed bytes differ from npm metadata: ${name}`);
    installed.push({ name, version: item.version, resolved: item.resolved, integrity: item.integrity });
  }
  const expectedNames = ['@orieken/saturday-reporting', cucumberOnly ? '@orieken/saturday-cucumber-formatter' : '@orieken/saturday-playwright-reporter'];
  assert.deepEqual(installed.map(item => item.name).sort(), expectedNames.sort());
  return installed;
}
