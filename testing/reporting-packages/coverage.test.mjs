import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { coverageFiles, evaluateCoverage } from './coverage-policy.mjs';
const baseline = () => ({ files: coverageFiles.map(path => ({ path: `/work/${path}`, coveredLinePercent: 100, coveredBranchPercent: 95, coveredFunctionPercent: 100 })) });
test('coverage gates apply separately to each adapter', () => {
  const summary = baseline();
  assert.equal(evaluateCoverage(summary).passed, true);
  summary.files[0].coveredBranchPercent = 89;
  assert.equal(evaluateCoverage(summary).passed, false);
  assert.equal(evaluateCoverage(summary).results[1].passed, true);
});
test('line and function regressions fail even when every test passes', () => {
  for (const metric of ['coveredLinePercent', 'coveredFunctionPercent']) {
    const summary = baseline(); summary.files[1][metric] = 99;
    assert.equal(evaluateCoverage(summary).passed, false);
  }
});
test('missing, ambiguous, or invalid coverage cannot satisfy the gate', () => {
  assert.equal(evaluateCoverage({ files: [] }).passed, false);
  const duplicate = baseline(); duplicate.files.push(duplicate.files[0]);
  assert.equal(evaluateCoverage(duplicate).passed, false);
  for (const value of [undefined, NaN, Infinity, 101]) {
    const summary = baseline(); summary.files[0].coveredLinePercent = value;
    assert.equal(evaluateCoverage(summary).passed, false);
  }
});
test('the actual test process fails coverage even when its control test passes', t => {
  const directory = mkdtempSync(join(realpathSync(tmpdir()), 'saturday-coverage-control-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const fixture = join(directory, 'passing.test.mjs'), output = join(directory, 'coverage');
  mkdirSync(output);
  writeFileSync(fixture, `import {test} from 'node:test'; import assert from 'node:assert/strict'; import Adapter from ${JSON.stringify(pathToFileURL(join(root, coverageFiles[0])).href)}; test('passing control',()=>assert.equal(typeof Adapter,'function'));\n`);
  const env = { ...process.env, SATURDAY_COVERAGE_DIR: output };
  delete env.NODE_V8_COVERAGE; delete env.NODE_TEST_CONTEXT;
  const child = spawnSync(process.execPath, ['--experimental-test-coverage', ...coverageFiles.map(file => `--test-coverage-include=${file}`),
    `--test-reporter=${fileURLToPath(new URL('./coverage-reporter.mjs', import.meta.url))}`, '--test', fixture,
  ], { cwd: root, env, encoding: 'utf8', timeout: 10000 });
  assert.equal(child.error, undefined);
  assert.notEqual(child.status, 0, 'uncovered callbacks must fail the CI process');
  const result = JSON.parse(readFileSync(join(output, 'summary.json')));
  assert.equal(result.passed, false);
  assert.ok(result.results[0].measured.functions < 100);
});
