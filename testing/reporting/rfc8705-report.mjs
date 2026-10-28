import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, lstatSync, copyFileSync } from 'node:fs';
import { resolve, join, relative, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { apiCases, browserCases } from '../rfc8705/cases.mjs';
import { scanArtifacts } from '../container/check-artifacts.mjs';
const root = resolve(process.argv[2]), operator = resolve(process.argv[3]);
const read = path => JSON.parse(readFileSync(path));
const provenance = read(join(root, 'provenance.json'));
const cleanup = read(join(root, 'cleanup.json'));
const rows = [], results = [], gaps = [];
const walk = path => existsSync(path) ? readdirSync(path).flatMap(name => {
  const file = join(path, name), info = lstatSync(file);
  assert.ok(!info.isSymbolicLink());
  return info.isDirectory() ? walk(file) : [file];
}) : [];
for (const browser of provenance.selections) {
  const path = join(root, browser, 'results.json');
  const result = existsSync(path) ? read(path) : { browser, cases: [] };
  results.push(result);
  if (result.runId !== provenance.runId || result.sourceContent !== provenance.sourceContent) gaps.push(`${browser}: missing/mismatched run provenance`);
  const expected = [...apiCases, ...browserCases];
  if (result.cases.length !== expected.length || new Set(result.cases.map(c => c.name)).size !== expected.length || !expected.every(name => result.cases.some(c => c.name === name && c.status === 'passed'))) gaps.push(`${browser}: incomplete or failing scenarios`);
  const privacy = join(root, browser, 'privacy.json');
  if (!existsSync(privacy) || read(privacy).status !== 'passed' || !read(privacy).decodedFramesChecked) gaps.push(`${browser}: privacy probe missing`);
  const group = join(root, 'recordings', `${browser}-playwright-baseline`, 'rfc8705');
  mkdirSync(group, { recursive: true });
  const entries = [], found = new Set();
  for (const file of walk(group).filter(file => file.endsWith('/recording.json'))) {
    const record = read(file);
    assert.equal(record.browser, browser); assert.equal(record.runner, 'playwright'); assert.equal(record.phase, 'baseline');
    assert.equal(record.auth_type, 'rfc8705'); assert.equal(record.privacy, 'provider-document-hidden-before-paint');
    assert.ok(browserCases.includes(record.name) && !found.has(record.name), 'Unknown or duplicated browser recording');
    found.add(record.name);
    const outcome = result.cases.find(c => c.name === record.name)?.status;
    assert.equal(record.status, outcome);
    assert.ok(Array.isArray(record.videos) && record.videos.length > 0);
    for (const video of record.videos) {
      const full = resolve(root, video);
      assert.ok(full.startsWith(`${dirname(file)}/`) && full.endsWith('.webm') && lstatSync(full).isFile() && lstatSync(full).size > 0);
      entries.push({ path: relative(group, full), name: record.name, spec: record.spec, status: record.status });
    }
  }
  if (!browserCases.every(name => found.has(name))) gaps.push(`${browser}: missing browser recordings`);
  const actualClips = walk(group).filter(file => file.endsWith('.webm')).length;
  assert.equal(actualClips, entries.length, 'Unlinked clips');
  for (let index = 0; index < expected.length; index++) {
    const evidence = join(root, browser, 'checks', `case-${index + 1}.json`);
    if (!existsSync(evidence) || read(evidence).name !== expected[index] || !read(evidence).checks.length || read(evidence).checks.some(check => check.actual !== check.expected)) gaps.push(`${browser}: missing/failing assertion evidence ${index + 1}`);
  }
  writeFileSync(join(group, 'video-cases.json'), JSON.stringify({ evidence: 'verified-authentication-video-cases', cases: entries }, null, 2));
  mkdirSync(join(group, 'html'), { recursive: true });
  writeFileSync(join(group, 'html/index.html'), `<!doctype html><html lang="en"><title>RFC 8705 recording selection</title><h1>${browser} RFC 8705</h1><p><a href="../../../../${browser}/index.html">Scenario and API results</a></p>`);
  rows.push({ os: 'debian', browser, runner: 'playwright', user: 'shop-admin', suite: 'rfc8705-baseline', auth_type: 'certificate', run_id: `${provenance.runId}-${browser}`, report: relative(root, group), status: result.cases.length === expected.length && result.cases.every(c => c.status === 'passed') ? 'passed' : 'failed' });
}
if (cleanup.status !== 'passed') gaps.push('Project cleanup incomplete');
const status = gaps.length ? 'failed' : 'passed';
writeFileSync(join(root, 'evidence.json'), JSON.stringify({ status, scope: provenance.scope, scenarios: results.flatMap(r => r.cases).length, browserScenarios: results.flatMap(r => r.cases).filter(c => c.evidence === 'browser-recording').length, videos: rows.reduce((n, row) => n + walk(join(root, row.report)).filter(p => p.endsWith('.webm')).length, 0), gaps }, null, 2));
writeFileSync(join(root, 'recording-matrix.json'), JSON.stringify({ id: provenance.runId, status, rows }, null, 2));
writeFileSync(join(root, 'matrix.json'), JSON.stringify({ id: provenance.runId, status: 'running', rows: [] }));
execFileSync(operator, ['--root', process.cwd(), '--project', 'magic-shop', 'matrix-merge', join(root, 'matrix.json'), join(root, 'recording-matrix.json')], { stdio: 'pipe' });
writeFileSync(join(root, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>RFC 8705 evidence</title><style>body{font:16px system-ui;max-width:1000px;margin:40px auto;padding:20px;background:#14213b;color:#edf2ff}a{color:#b7d6ff}li{margin:12px 0}</style><h1>RFC 8705 recorded authentication tests</h1><p>Run: ${provenance.runId} · Scenario inventory and cleanup: ${status}</p><p>Real provider authorization with test-owned callback capture; real browser API navigation. API-only checks have separate structured evidence. Certificate injection; native OS selection is outside this run. Final report playback verification is recorded in playback.json.</p><ul><li><a href="matrix.html">Filterable video matrix</a></li>${['provenance.json', 'evidence.json', 'cleanup.json', ...provenance.selections.flatMap(b => [`${b}/index.html`, `${b}/results.json`, `${b}/junit.xml`, `${b}/privacy.json`])].filter(p => existsSync(join(root, p))).map(p => `<li><a href="${p}">${p}</a></li>`).join('')}</ul>`);
await scanArtifacts(root, { requireMountedPath: false });
if (!gaps.length) {
  const site = join(root, 'site');
  execFileSync(operator, ['--root', process.cwd(), '--project', 'magic-shop', 'matrix-site', join(root, 'matrix.json'), site], { stdio: 'pipe' });
  const evidence = join(site, 'evidence'); mkdirSync(evidence);
  for (const name of ['provenance.json', 'evidence.json', 'cleanup.json']) copyFileSync(join(root, name), join(evidence, name));
  for (const browser of provenance.selections) for (const file of walk(join(root, browser))) {
    const dest = join(evidence, relative(root, file)); mkdirSync(dirname(dest), { recursive: true });
    if (file.endsWith('.html')) writeFileSync(dest, readFileSync(file, 'utf8').replaceAll('../matrix.html', '../../index.html'));
    else copyFileSync(file, dest);
  }
  const links = walk(evidence).map(p => relative(site, p));
  writeFileSync(join(evidence, 'index.html'), `<!doctype html><html lang="en"><title>RFC 8705 evidence</title><h1>Scenario and API evidence</h1><p><a href="../index.html">Video matrix</a></p><ul>${links.map(p => `<li><a href="../${p}">${p}</a></li>`).join('')}</ul>`);
  for (const name of ['index.html', 'matrix.html']) {
    const path = join(site, name); writeFileSync(path, readFileSync(path, 'utf8').replace('<body>', '<body><nav><a href="evidence/index.html">Scenario results, API evidence and run provenance</a></nav>'));
  }
}
if (gaps.length) throw new Error('RFC 8705 evidence incomplete; review evidence.json');
console.log('PASS: exact scenario/video inventories and safe matrix report');
