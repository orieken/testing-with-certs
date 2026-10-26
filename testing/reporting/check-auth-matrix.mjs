import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authPhases, oidcPhases, otpPhases } from '../teaching/auth-matrix.mjs';

export function checkAuthMatrix(suite, root) {
  assert.ok(['auth-lessons', 'oidc', 'password-otp'].includes(suite), 'Unknown authentication suite');
  const phases = suite === 'oidc' ? oidcPhases : suite === 'auth-lessons' ? authPhases : otpPhases;
  let count = 0;
  for (const browser of ['chrome', 'msedge']) for (const [phase, expected] of Object.entries(phases)) {
    const selection = `${browser}-${phase}`;
    const report = JSON.parse(readFileSync(join(root, selection, 'results.json'), 'utf8'));
    assert.equal(report.evidence, suite !== 'password-otp' ? 'live-authentication-lessons' : 'live-password-otp', 'Wrong evidence provenance');
    assert.equal(report.browser, browser, 'Wrong browser');
    if (suite !== 'password-otp') assert.equal(report.phase, phase, 'Wrong phase');
    else {
      assert.equal(report.runner, phase.split('-')[0], 'Wrong runner');
      assert.equal(report.phase, phase.endsWith('-lifecycle') ? 'lifecycle' : 'baseline', 'Wrong OTP phase');
    }
    assert.ok(Array.isArray(report.cases), 'Missing cases');
    assert.equal(report.cases.length, expected.length, 'Missing or extra cases');
    assert.equal(new Set(report.cases.map(value => value.name)).size, expected.length, 'Duplicate cases');
    for (const value of report.cases) {
      assert.ok(expected.includes(value.name), 'Unknown case');
      assert.equal(value.status, 'passed', 'Unsuccessful case');
      count++;
    }
  }
  return count;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const count = checkAuthMatrix(process.argv[2], process.argv[3]);
  console.log(`${process.argv[2]} matrix complete: ${count}/${count} required cases passed`);
}
