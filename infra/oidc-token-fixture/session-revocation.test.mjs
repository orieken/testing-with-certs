import { test } from 'node:test';
import assert from 'node:assert/strict';
import { revokeOwnedProviderSessions } from './session-revocation.mjs';
function fixture({ users, sessions = 2, notification = false, stays = false } = {}) {
  const calls = [], kind = 'upstream-session-revoked';
  const admin = async (method, path, body, expected) => {
    calls.push({ method, path });
    if (path.startsWith('/users?')) return users ?? [{ id: 'owned-user', username: `oidc-test-${kind}` }];
    if (path.startsWith('/clients?')) return [{ frontchannelLogout: notification }];
    if (method === 'POST') { assert.equal(path, '/users/owned-user/logout'); assert.equal(body, undefined); assert.equal(expected, 204); if (!stays) sessions = 0; return; }
    assert.equal(path, '/users/owned-user/sessions'); return Array.from({ length: sessions }, () => ({ id: 'private-session' }));
  };
  return { admin, calls };
}
test('native session revocation touches only the exact owned account and returns counts without session identifiers', async () => {
  const { admin, calls } = fixture(); const result = await revokeOwnedProviderSessions(admin, 'upstream-session-revoked');
  assert.deepEqual(result, { revoked: true, sessionsBefore: 2, sessionsAfter: 0, logoutNotificationConfigured: false });
  assert.equal(calls.filter(c => c.method === 'POST').length, 1); assert.equal(JSON.stringify(result).includes('private-session'), false);
});
test('unowned selectors and missing, ambiguous or mismatched accounts cannot revoke sessions', async () => {
  const unknown = fixture(); await assert.rejects(revokeOwnedProviderSessions(unknown.admin, 'administrator')); assert.equal(unknown.calls.length, 0);
  for (const users of [[], [{ id: 'unexpected', username: 'other' }], [{}, {}]]) {
    const { admin, calls } = fixture({ users }); await assert.rejects(revokeOwnedProviderSessions(admin, 'upstream-session-revoked'));
    assert.equal(calls.some(c => c.method === 'POST'), false);
  }
});
test('session revocation requires an active control and verifies actual deletion', async () => {
  const absent = fixture({ sessions: 0 }); await assert.rejects(revokeOwnedProviderSessions(absent.admin, 'upstream-session-revoked')); assert.equal(absent.calls.some(c => c.method === 'POST'), false);
  await assert.rejects(revokeOwnedProviderSessions(fixture({ stays: true }).admin, 'upstream-session-revoked'));
});
test('broker-boundary probe refuses unexpected logout notification configuration before revocation', async () => {
  const kind = 'upstream-revocation-broker-boundary';
  const { admin, calls } = fixture({ notification: true, users: [{ id: 'owned-user', username: `oidc-test-${kind}` }] });
  await assert.rejects(revokeOwnedProviderSessions(admin, kind)); assert.equal(calls.some(c => c.method === 'POST'), false);
});
