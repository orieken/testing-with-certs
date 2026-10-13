import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checks } from './password-results.mjs';
let count = 0;
for (const browser of ['chrome', 'msedge']) {
  for (const runner of ['playwright', 'cucumber']) {
    const root = `/work/artifacts/certificate-password-ci/${browser}-${runner}`;
    const report = JSON.parse(readFileSync(`${root}/results.json`, 'utf8'));
    assert.equal(report.evidence, 'live-certificate-password');
    assert.equal(report.browser, browser); assert.equal(report.runner, runner);
    assert.deepEqual(report.cases.map(entry => entry.kind).sort(), [...checks].sort());
    assert.ok(report.cases.every(entry => entry.status === 'passed'), 'Every required scenario passed');
    assert.ok(readFileSync(`${root}/junit.xml`, 'utf8').includes('failures="0"'));
    count += report.cases.length;
  }
}
assert.equal(count, 36);
console.log('Teaching evidence gate: all 36 required live scenarios present and passed.');
