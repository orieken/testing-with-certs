import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
const fixture = process.env.LAB_RFC8705_TEST_REPORT;
const walk = path => readdirSync(path, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(join(path, entry.name)) : [join(path, entry.name)]);
const changes = {
  'a missing video': root => rmSync(walk(join(root, 'recordings')).find(path => path.endsWith('.webm'))),
  'duplicated scenario results': root => {
    const path = join(root, 'chrome/results.json'), data = JSON.parse(readFileSync(path));
    data.cases[1] = data.cases[0]; writeFileSync(path, JSON.stringify(data));
  },
  'wrong run provenance': root => {
    const path = join(root, 'chrome/results.json'), data = JSON.parse(readFileSync(path));
    data.runId = 'another-run'; writeFileSync(path, JSON.stringify(data));
  },
  'missing visual privacy evidence': root => rmSync(join(root, 'chrome/privacy.json')),
  'credential-shaped diagnostic content': root => writeFileSync(join(root, 'unsafe.json'), JSON.stringify({ access_token: 'synthetic-scan-probe' })),
};
changes['unmodified accepted evidence'] = () => {};
for (const [name, change] of Object.entries(changes)) test(`recorded report validates ${name}`, { skip: !fixture }, () => {
  const source = resolve(fixture);
  assert.equal(JSON.parse(readFileSync(join(source, 'evidence.json'))).status, 'passed', 'A fully accepted source fixture is required');
  assert.equal(JSON.parse(readFileSync(join(source, 'playback.json'))).status, 'passed', 'Source playback must already be verified');
  const root = mkdtempSync(join(process.cwd(), 'artifacts/rfc8705-gate-probe-'));
  try {
    cpSync(source, root, { recursive: true, filter: path => !['site', 'matrix.json', 'matrix.html', 'matrix.md', 'recording-matrix.json', 'index.html', 'evidence.json', 'playback.json'].includes(relative(source, path).split('/')[0]) });
    change(root);
    const result = spawnSync(process.execPath, ['testing/reporting/rfc8705-report.mjs', root, 'artifacts/operator/bin/magic-shop-operator'], { stdio: 'pipe', timeout: 30000 });
    if (name === 'unmodified accepted evidence') {
      assert.equal(result.status, 0, 'An unmodified accepted fixture must export');
      assert.equal(existsSync(join(root, 'site/index.html')), true);
    } else {
      assert.notEqual(result.status, 0, 'Incomplete/unsafe evidence must fail the gate');
      assert.equal(existsSync(join(root, 'site')), false, 'A passing portable report must not be exported');
      const expected = name === 'a missing video' ? /ENOENT/ : name === 'credential-shaped diagnostic content' ? /Credential-like content/ : /evidence incomplete/;
      assert.match(result.stderr.toString(), expected, 'The intended gate must reject the mutation');
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
