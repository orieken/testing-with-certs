import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeAuthResult, finishAuthReport } from './auth-lessons.mjs';

test('shared authentication reporting exports only allowlisted names and normalized outcomes', () => {
  const sensitive = { name: 'passkeys:enrollment', status: 'PASSED', privateKey: 'never-export', error: 'never-export' };
  assert.deepEqual(safeAuthResult(sensitive.name, sensitive.status), { name: sensitive.name, status: 'passed' });
  for (const status of ['skipped', 'PENDING', 'UNDEFINED', 'FAILED', undefined]) assert.equal(safeAuthResult(sensitive.name, status).status, 'failed');
  assert.throws(() => safeAuthResult('unknown', 'passed'));
  assert.throws(() => finishAuthReport('unknown', 'passkeys-cucumber', []));
  assert.throws(() => finishAuthReport('chrome', 'unknown', []));
});
