import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { timingSafeEqual } from 'node:crypto';
import { lessonAdmin } from '../keycloak/lesson-admin.mjs';
import { keycloakKeyAction, restoreOwnedKeycloakKey } from './keycloak-keys.mjs';
import { refreshPolicy, restoreRefreshPolicy } from './refresh-policy.mjs';
import { revokeOwnedProviderSessions } from './session-revocation.mjs';
const sessionKinds = ['upstream-session-revoked', 'upstream-revocation-broker-boundary'];
const refreshRealms = { keycloak: 'lesson-provider', broker: 'lesson-oidc', 'authentik-broker': 'lesson-authentik-oidc' };
let busy = false;
const secret = Buffer.from(`Bearer ${readFileSync('/state/client-secret', 'utf8')}`);
function reply(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); response.end(JSON.stringify(value));
}
async function handle(request, response) {
  if (request.url === '/health' && request.method === 'GET') return reply(response, 200, { ready: true });
  const credential = Buffer.from(request.headers.authorization ?? '');
  if (credential.length !== secret.length || !timingSafeEqual(credential, secret)) return reply(response, 403, { ok: false });
  const sessionKind = request.url.startsWith('/sessions/') ? request.url.slice('/sessions/'.length) : undefined;
  const refreshTarget = request.url.startsWith('/refresh/') ? request.url.slice('/refresh/'.length) : undefined;
  if ((request.url !== '/keycloak' && !Object.hasOwn(refreshRealms, refreshTarget ?? '') && !sessionKinds.includes(sessionKind)) || request.method !== 'POST') return reply(response, 404, { ok: false });
  let body = '';
  for await (const chunk of request) { body += chunk; if (body.length > 4096) throw new Error('Request bound'); }
  const { action, owner } = JSON.parse(body);
  if (!['start', 'rotate', 'status', 'restore', 'cleanup', 'verify', 'revoke'].includes(action) || !['cleanup', 'verify'].includes(action) && !/^[a-f0-9-]{36}$/.test(owner ?? '')) return reply(response, 400, { ok: false });
  if (refreshTarget && !['start', 'restore', 'cleanup', 'verify'].includes(action)) return reply(response, 400, { ok: false });
  if (sessionKind && action !== 'revoke' || !sessionKind && action === 'revoke') return reply(response, 400, { ok: false });
  if (busy) return reply(response, 409, { error: 'native_key_action_busy' });
  busy = true;
  try {
    const admin = await lessonAdmin({ origin: 'https://shop.magic.test:9643', realm: refreshTarget ? refreshRealms[refreshTarget] : 'lesson-provider' });
    if (sessionKind) return reply(response, 200, await revokeOwnedProviderSessions(admin, sessionKind));
    if (refreshTarget) {
      const path = `/state/refresh-${refreshTarget}.json`;
      const value = action === 'cleanup' ? await restoreRefreshPolicy(admin, path) : await refreshPolicy(admin, path, action, owner);
      return reply(response, 200, value);
    }
    const value = action === 'cleanup' ? await restoreOwnedKeycloakKey(admin, '/state') : await keycloakKeyAction(admin, '/state', action, owner);
    reply(response, 200, value);
  } finally { busy = false; }
}
createServer((request, response) => { handle(request, response).catch(() => reply(response, 409, { error: 'owned_native_key_action_failed' })); })
  .listen(9103, '0.0.0.0');
