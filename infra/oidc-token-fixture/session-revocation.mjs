const allowed = ['upstream-session-revoked', 'upstream-revocation-broker-boundary'];
export async function revokeOwnedProviderSessions(admin, kind) {
  if (!allowed.includes(kind)) throw new Error('Unowned session fixture');
  const username = `oidc-test-${kind}`;
  const users = await admin('GET', `/users?username=${username}&exact=true&max=2`);
  if (users.length !== 1 || users[0].username !== username || !users[0].id) throw new Error('Owned session account missing or ambiguous');
  const path = `/users/${users[0].id}`;
  const before = await admin('GET', `${path}/sessions`);
  if (!before.length) throw new Error('No owned provider session to revoke');
  if (kind === 'upstream-revocation-broker-boundary') {
    const clients = await admin('GET', '/clients?clientId=lesson-oidc-broker&max=2');
    if (clients.length !== 1 || clients[0].frontchannelLogout || clients[0].adminUrl || clients[0].attributes?.['backchannel.logout.url']) throw new Error('Unexpected upstream logout notification');
  }
  await admin('POST', `${path}/logout`, undefined, 204);
  const after = await admin('GET', `${path}/sessions`);
  if (after.length) throw new Error('Owned provider sessions remain');
  return { revoked: true, sessionsBefore: before.length, sessionsAfter: 0, logoutNotificationConfigured: false };
}
