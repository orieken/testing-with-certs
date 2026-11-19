import assert from 'node:assert/strict';
import { test } from 'node:test';
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
