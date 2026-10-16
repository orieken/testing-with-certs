import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authPhases, otpCaseNames } from '../teaching/auth-matrix.mjs';

export function checkAuthMatrix(suite, root) {
  assert.ok(['auth-lessons', 'password-otp'].includes(suite), 'Unknown authentication suite');
  const phases = suite === 'auth-lessons' ? authPhases : { otp: otpCaseNames };
  let count = 0;
  for (const browser of ['chrome', 'msedge']) for (const [phase, expected] of Object.entries(phases)) {
    const selection = suite === 'auth-lessons' ? `${browser}-${phase}` : browser;
    const report = JSON.parse(readFileSync(join(root, selection, 'results.json'), 'utf8'));
    assert.equal(report.evidence, suite === 'auth-lessons' ? 'live-authentication-lessons' : 'live-password-otp', 'Wrong evidence provenance');
    assert.equal(report.browser, browser, 'Wrong browser');
    if (suite === 'auth-lessons') assert.equal(report.phase, phase, 'Wrong phase');
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
  console.log(`Authentication matrix complete: ${count}/${count} required cases passed`);
}
