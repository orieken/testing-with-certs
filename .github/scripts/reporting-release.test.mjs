import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { assertPublishingContext, integrity, makePlan, names, registryState, releaseVersion } from './reporting-release.mjs';
import { checkedRun } from './reporting-release-gate.mjs';
const manifest = (name, version = '0.1.0') => ({ name: `@orieken/${name}`, version, publishConfig: { access: 'public' }, repository: { url: 'https://github.com/orieken/testing-with-certs.git' }, ...(name === 'saturday-reporting' ? {} : { dependencies: { '@orieken/saturday-reporting': `workspace:${version}` } }) });
test('release tag, coordinated versions, and core dependencies must agree', () => {
  const manifests = names.map(name => manifest(name));
  assert.equal(releaseVersion(manifests, 'saturday-reporting-v0.1.0'), '0.1.0');
  assert.throws(() => releaseVersion(manifests, 'v0.1.0'), /tag/);
  manifests[1].version = '0.2.0';
  assert.throws(() => releaseVersion(manifests), /same version/);
  manifests[1].version = '0.1.0'; manifests[1].dependencies['@orieken/saturday-reporting'] = 'workspace:*';
  assert.throws(() => releaseVersion(manifests), /dependency must match/);
});
test('private packages and invalid semantic versions cannot be released', () => {
  const manifests = names.map(name => manifest(name));
  manifests[0].private = true;
  assert.throws(() => releaseVersion(manifests), /publishable/);
  for (const version of ['01.0.0', '0.1', '0.1.0-01']) assert.throws(() => releaseVersion(names.map(name => manifest(name, version))));
  assert.equal(releaseVersion(names.map(name => manifest(name, '0.2.0-rc.1'))), '0.2.0-rc.1');
});
test('only the exact main push run satisfies the release gate', () => {
  const run = { id: 1, head_sha: 'sha', head_branch: 'main', event: 'push', path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success' };
  assert.equal(checkedRun([run], 'sha', 'ci.yml'), 'success');
  assert.equal(checkedRun([{ ...run, head_sha: 'other' }], 'sha', 'ci.yml'), 'pending');
  assert.equal(checkedRun([{ ...run, event: 'pull_request' }], 'sha', 'ci.yml'), 'pending');
  assert.equal(checkedRun([{ ...run, status: 'in_progress' }], 'sha', 'ci.yml'), 'pending');
  assert.throws(() => checkedRun([run, { ...run, id: 2, conclusion: 'failure' }], 'sha', 'ci.yml'), /must pass/);
});
test('publishing is restricted to repository tag pushes in Actions', () => {
  const env = { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'orieken/testing-with-certs', GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/tags/saturday-reporting-v0.1.0' };
  assert.doesNotThrow(() => assertPublishingContext(env));
  for (const overrides of [{ GITHUB_EVENT_NAME: 'pull_request' }, { GITHUB_REF: 'refs/heads/main' }, { GITHUB_ACTIONS: 'false' }, { GITHUB_REPOSITORY: 'someone/fork' }]) assert.throws(() => assertPublishingContext({ ...env, ...overrides }));
});
test('registry retry preflight distinguishes absent versions from identical published bytes', async () => {
  const packages = [{ name: '@orieken/example', version: '0.1.0', integrity: 'sha512-same' }];
  const absent = await registryState(packages, async () => ({ status: 404 }));
  assert.equal(absent[0].published, false);
  const existing = await registryState(packages, async () => ({ status: 200, json: async () => ({ dist: { integrity: 'sha512-same' } }) }));
  assert.equal(existing[0].published, true);
});
test('registry errors and immutable-version collisions fail before publication', async () => {
  const packages = [{ name: '@orieken/example', version: '0.1.0', integrity: 'sha512-same' }];
  await assert.rejects(registryState(packages, async () => ({ status: 503 })), /Cannot inspect/);
  await assert.rejects(registryState(packages, async () => ({ status: 200, json: async () => ({ dist: { integrity: 'sha512-other' } }) })), /different bytes/);
});
function fixture(t, brokenDependency = false) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'saturday-release-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const output = join(root, 'artifacts'); mkdirSync(output);
  for (const name of names) {
    const source = manifest(name), directory = join(root, 'packages', name);
    mkdirSync(directory, { recursive: true }); writeFileSync(join(directory, 'package.json'), JSON.stringify(source));
    const stage = join(root, `stage-${name}`), packed = join(stage, 'package');
    mkdirSync(join(packed, 'dist'), { recursive: true });
    const packaged = { ...source, ...(source.dependencies ? { dependencies: { '@orieken/saturday-reporting': brokenDependency ? 'workspace:0.1.0' : '0.1.0' } } : {}) };
    writeFileSync(join(packed, 'package.json'), JSON.stringify(packaged));
    for (const file of ['LICENSE', 'NOTICE', 'README.md', 'dist/index.js', 'dist/index.d.ts']) writeFileSync(join(packed, file), 'fixture');
    execFileSync('tar', ['-czf', join(output, `orieken-${name}-0.1.0.tgz`), '-C', stage, 'package']);
  }
  return { root, output };
}
test('release plan records the exact tested tarballs in dependency order', t => {
  const { root, output } = fixture(t);
  const plan = makePlan(root, output, { tag: 'saturday-reporting-v0.1.0', sourceCommit: 'commit' });
  assert.deepEqual(plan.packages.map(item => item.name), names.map(name => `@orieken/${name}`));
  assert.equal(plan.distTag, 'latest');
  for (const item of plan.packages) assert.equal(item.integrity, integrity(join(output, item.file)));
});
test('a leaked workspace dependency in a tarball blocks release', t => {
  const { root, output } = fixture(t, true);
  assert.throws(() => makePlan(root, output, { sourceCommit: 'commit' }), /workspace paths/);
});
