import { readFile, readdir, lstat } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';

const root = resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Provide a Cucumber report directory');
const policy = process.argv[3] ?? 'enabled';
if (!['enabled', 'disabled'].includes(policy)) throw new Error('Expected enabled or disabled');
const features = JSON.parse(await readFile(join(root, 'cucumber.json'), 'utf8'));
const expected = [];
for (const feature of features) for (const scenario of feature.elements ?? []) {
  if (scenario.type !== 'scenario') continue;
  const results = [...(scenario.before ?? []), ...(scenario.steps ?? []), ...(scenario.after ?? [])].map(step => step.result?.status);
  if (!results.length || results.some(status => status !== 'passed')) throw new Error('Cucumber acceptance requires all scenario steps and hooks passed');
  expected.push(JSON.stringify([feature.uri, scenario.name, 'passed']));
}
if (!expected.length) throw new Error('No observed Cucumber scenarios');
const index = JSON.parse(await readFile(join(root, policy === 'enabled' ? 'video-cases.json' : 'recording-policy.json'), 'utf8'));
if (index.evidence !== (policy === 'enabled' ? 'verified-authentication-video-cases' : 'explicit-recording-policy')) throw new Error('Unsupported producer evidence');
if (policy === 'disabled' && index.recording !== 'disabled') throw new Error('Missing disabled policy');
const actual = [], paths = new Set();
for (const entry of index.cases) {
  actual.push(JSON.stringify([entry.spec, entry.name, entry.status.toLowerCase()]));
  if (policy === 'disabled') {
    if (entry.path) throw new Error('Disabled case claims a recording');
    continue;
  }
  const path = resolve(root, entry.path);
  const rel = relative(root, path);
  if (!entry.path || rel.startsWith('..') || paths.has(path)) throw new Error('Unsafe or duplicate recording path');
  paths.add(path);
  // Check every path component: no symlink may escape the report tree.
  let component = root;
  for (const part of rel.split('/')) {
    component = join(component, part);
    if ((await lstat(component)).isSymbolicLink()) throw new Error('Recording symlink');
  }
  const info = await lstat(path);
  if (!info.isFile() || info.size === 0) throw new Error('Missing or empty recording');
}
if (JSON.stringify(actual.sort()) !== JSON.stringify(expected.sort())) throw new Error('Scenario/spec/result index differs from observed Cucumber results');
async function videos(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Report symlink');
    if (entry.isDirectory()) found.push(...await videos(path));
    else if (/\.(webm|mp4)$/i.test(entry.name)) found.push(path);
  }
  return found;
}
const files = await videos(root);
if (policy === 'enabled' && (files.length !== paths.size || files.some(path => !paths.has(path)))) throw new Error('Unindexed video file');
if (policy === 'disabled' && files.length) throw new Error('Disabled selection saved video files');
console.log(`${expected.length} exact Cucumber cases; recording ${policy}; ${files.length} video files verified`);
