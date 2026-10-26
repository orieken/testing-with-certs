import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { refreshPolicy, restoreRefreshPolicy } from './refresh-policy.mjs';
function fixture(run) {
  return async () => {
    const dir = mkdtempSync(join(tmpdir(), 'refresh-policy-')), path = join(dir, 'state.json');
    const value = { realm: 'owned-test', revokeRefreshToken: false, refreshTokenMaxReuse: 3, unrelated: true };
    const admin = async (method, route, body) => {
      assert.equal(route, '');
      if (method === 'PUT') Object.assign(value, body);
      else assert.equal(method, 'GET');
      return structuredClone(value);
    };
    try { await run({ path, value, admin }); } finally { rmSync(dir, { recursive: true, force: true }); }
  };
}
test('refresh policy snapshots exact original values and restores only owned fields', fixture(async ({ path, value, admin }) => {
  assert.deepEqual(await refreshPolicy(admin, path, 'start', 'owner'), { idle: false, rotation: true, maxReuse: 0 });
  assert.equal(value.revokeRefreshToken, true); assert.equal(value.refreshTokenMaxReuse, 0);
  await assert.rejects(refreshPolicy(admin, path, 'start', 'other'));
  await assert.rejects(refreshPolicy(admin, path, 'restore', 'other'));
  await assert.rejects(refreshPolicy(admin, path, 'verify'));
  await refreshPolicy(admin, path, 'restore', 'owner');
  assert.equal(value.revokeRefreshToken, false); assert.equal(value.refreshTokenMaxReuse, 3); assert.equal(value.unrelated, true);
  assert.equal(existsSync(path), false);
}));
test('refresh policy recovers both unapplied and applied mutations after administration failures', fixture(async ({ path, value, admin }) => {
  for (const apply of [false, true]) {
    const failed = async (method, route, body) => { if (method !== 'PUT') return admin(method, route, body); if (apply) await admin(method, route, body); throw new Error('Interrupted response'); };
    await assert.rejects(refreshPolicy(failed, path, 'start', 'owner'));
    assert.equal(existsSync(path), true);
    await restoreRefreshPolicy(admin, path);
    assert.equal(value.revokeRefreshToken, false); assert.equal(value.refreshTokenMaxReuse, 3);
  }
}));
test('refresh policy refuses ownership drift and preserves its recovery journal', fixture(async ({ path, value, admin }) => {
  await refreshPolicy(admin, path, 'start', 'owner'); value.refreshTokenMaxReuse = 8;
  await assert.rejects(restoreRefreshPolicy(admin, path)); assert.equal(existsSync(path), true);
  value.refreshTokenMaxReuse = 0; value.realm = 'unexpected';
  await assert.rejects(restoreRefreshPolicy(admin, path)); assert.equal(existsSync(path), true);
}));
