import { test } from 'node:test';
import assert from 'node:assert/strict';
import { otpReport } from './otp-results.mjs';
import { otpCaseNames, otpSessionCaseNames } from '../teaching/auth-matrix.mjs';
test('OTP evidence strips raw diagnostic/credential fields and treats all non-passes as failures', () => {
  for (const status of ['FAILED', 'SKIPPED', 'PENDING', 'UNDEFINED', 'AMBIGUOUS', 'failed', 'timedOut']) {
    const report = otpReport('chrome', 'cucumber', [{name:otpCaseNames[0],status,error:{password:'private-fixture-value'},attachments:['raw']}]);
    assert.deepEqual(report.cases,[{name:otpCaseNames[0],status:'failed'}]);
    assert.equal(JSON.stringify(report).includes('private-fixture-value'),false);
  }
  assert.equal(otpReport('msedge','playwright',[{name:otpCaseNames[0],status:'passed'}]).cases[0].status,'passed');
  assert.equal(otpReport('chrome','cucumber',[{name:otpCaseNames[0],status:'PASSED'}]).cases[0].status,'passed');
  assert.throws(()=>otpReport('unknown','cucumber',[]));
  assert.throws(()=>otpReport('chrome','unknown',[]));
  assert.throws(()=>otpReport('chrome','cucumber',[{name:'untrusted input',status:'PASSED'}]));
});

test('OTP lifecycle reports retain phase provenance and discard refresh-token diagnostics', () => {
  const report=otpReport('chrome','playwright',[{name:otpSessionCaseNames[0],status:'PASSED',refresh_token:'private-fixture-value'}],'lifecycle');
  assert.equal(report.phase,'lifecycle'); assert.equal(JSON.stringify(report).includes('private-fixture-value'),false);
  assert.throws(()=>otpReport('chrome','playwright',[],'unknown'));
});
