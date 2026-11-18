import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const names = ['saturday-reporting', 'saturday-playwright-reporter', 'saturday-cucumber-formatter'];
export const repository = 'orieken/testing-with-certs';
const registry = 'https://registry.npmjs.org';
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const read = path => JSON.parse(readFileSync(path, 'utf8'));
export const integrity = path => `sha512-${createHash('sha512').update(readFileSync(path)).digest('base64')}`;

export function releaseVersion(manifests, tag) {
  const version = manifests[0]?.version;
  assert.ok(typeof version === 'string' && versionPattern.test(version), 'A semantic package version is required');
  assert.ok(!version.split('-').slice(1).join('-').split('.').some(part => /^0\d+$/.test(part)), 'Numeric prerelease identifiers must not have leading zeroes');
  assert.ok(manifests.every(manifest => manifest.version === version), 'All three reporting packages must have the same version');
  if (tag !== undefined) assert.equal(tag, `saturday-reporting-v${version}`, 'Release tag must match package versions');
  for (const manifest of manifests) {
    assert.ok(manifest.private === undefined || manifest.private === false, 'Release packages must be publishable');
    assert.equal(manifest.publishConfig?.access, 'public');
    assert.equal(manifest.repository?.url, `https://github.com/${repository}.git`);
    if (manifest.name !== '@orieken/saturday-reporting') assert.equal(manifest.dependencies?.['@orieken/saturday-reporting'], `workspace:${version}`, 'Adapter dependency must match the coordinated version');
  }
  return version;
}
export function makePlan(root, directory, { tag, sourceCommit } = {}) {
  const manifests = names.map(name => read(join(root, 'packages', name, 'package.json')));
  const version = releaseVersion(manifests, tag);
  const packages = manifests.map((manifest, index) => {
    const expected = `@orieken/${names[index]}`;
    assert.equal(manifest.name, expected);
    const file = `orieken-${names[index]}-${version}.tgz`, path = join(directory, file);
    assert.ok(lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink(), 'Release tarball must be a regular file');
    const packed = JSON.parse(execFileSync('tar', ['-xOf', path, 'package/package.json'], { encoding: 'utf8' }));
    assert.equal(packed.name, expected); assert.equal(packed.version, version);
    if (index > 0) assert.equal(packed.dependencies?.['@orieken/saturday-reporting'], version, 'Packed dependencies must not use workspace paths');
    const entries = execFileSync('tar', ['-tzf', path], { encoding: 'utf8' }).trim().split('\n');
    assert.ok(entries.every(entry => entry.startsWith('package/') && !entry.split('/').includes('..')), 'Unsafe tarball entry');
    for (const required of ['package/package.json', 'package/LICENSE', 'package/NOTICE', 'package/README.md', 'package/dist/index.js', 'package/dist/index.d.ts']) assert.ok(entries.includes(required), `Missing package file: ${required}`);
    return { name: expected, version, file, integrity: integrity(path) };
  });
  return { schemaVersion: 1, sourceCommit: sourceCommit ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), version, distTag: version.includes('-') ? 'next' : 'latest', packages };
}
export async function registryState(packages, request = fetch) {
  return Promise.all(packages.map(async item => {
    const response = await request(`${registry}/${encodeURIComponent(item.name)}/${item.version}`, { signal: AbortSignal.timeout(30000) });
    if (response.status === 404) return { ...item, published: false };
    assert.equal(response.status, 200, `Cannot inspect npm version for ${item.name}`);
    const existing = await response.json();
    assert.equal(existing.dist?.integrity, item.integrity, `Published version has different bytes: ${item.name}@${item.version}`);
    return { ...item, published: true };
  }));
}
export function assertPublishingContext(env) {
  assert.equal(env.GITHUB_ACTIONS, 'true', 'Actual publication runs in GitHub Actions');
  assert.equal(env.GITHUB_REPOSITORY, repository);
  assert.equal(env.GITHUB_EVENT_NAME, 'push');
  assert.match(env.GITHUB_REF ?? '', /^refs\/tags\/saturday-reporting-v/);
}
async function main() {
  const [command, folder = 'artifacts/saturday-reporting'] = process.argv.slice(2);
  assert.ok(['plan', 'dry-run', 'publish'].includes(command), 'Usage: reporting-release.mjs plan|dry-run|publish [artifact-directory]');
  const root = resolve(fileURLToPath(new URL('../../', import.meta.url))), directory = resolve(folder);
  const tag = process.env.GITHUB_EVENT_NAME === 'push' && process.env.GITHUB_REF?.startsWith('refs/tags/') ? process.env.GITHUB_REF_NAME : undefined;
  const plan = makePlan(root, directory, { tag });
  const planPath = join(directory, 'release-plan.json');
  if (command === 'plan') {
    writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n');
    console.log(JSON.stringify(plan)); return;
  }
  assert.deepEqual(read(planPath), plan, 'Downloaded release artifacts do not match this checkout or plan');
  if (command === 'publish') assertPublishingContext(process.env);
  const packages = command === 'publish' ? await registryState(plan.packages) : plan.packages.map(item => ({ ...item, published: false }));
  const results = [];
  for (const item of packages) {
    if (!item.published) execFileSync('npm', [
      'publish', join(directory, item.file), '--access', 'public', '--ignore-scripts', '--registry', registry, '--tag', plan.distTag,
      ...(command === 'dry-run' ? ['--dry-run'] : ['--provenance']),
    ], { stdio: 'inherit' });
    results.push({ name: item.name, version: item.version, status: item.published ? 'already published with matching integrity' : command === 'dry-run' ? 'dry run passed' : 'published' });
  }
  writeFileSync(join(directory, 'publish-results.json'), JSON.stringify(results, null, 2) + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Saturday npm ${command}\n\n${results.map(item => `- ${item.name}@${item.version}: ${item.status}`).join('\n')}\n`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
