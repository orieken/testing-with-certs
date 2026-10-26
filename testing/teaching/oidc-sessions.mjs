import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import { captureCallback } from './authentik-boundaries.mjs';
import { upstreamSessionCases } from './oidc-session-cases.mjs';
const broker = 'https://shop.magic.test:9643';
const claims = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
function specification(provider) {
  const authentik = provider === 'authentik';
  const origin = authentik ? 'https://shop.magic.test:9743' : broker;
  const prefix = authentik ? `${origin}/application/o` : `${origin}/realms/lesson-provider/protocol/openid-connect`;
  const callback = `${broker}/realms/lesson-${authentik ? 'authentik-oidc' : 'oidc'}/broker/${authentik ? 'authentik-oidc' : 'lesson-oidc'}/endpoint`;
  return { authentik, origin, prefix, callback, client: authentik ? 'authentik-oidc-broker' : 'lesson-oidc-broker',
    issuer: authentik ? `${prefix}/lesson-oidc/` : `${origin}/realms/lesson-provider`,
    auth: `${prefix}/${authentik ? 'authorize/' : 'auth'}`, userinfo: `${prefix}/${authentik ? 'userinfo/' : 'userinfo'}`,
    logout: authentik ? `${prefix}/lesson-oidc/end-session/` : `${prefix}/logout`, revoke: `${prefix}/revoke${authentik ? '/' : ''}` };
}
async function silentSso(context, spec, expected) {
  const state = randomBytes(24).toString('base64url'), verifier = randomBytes(32).toString('base64url');
  const url = new URL(spec.auth);
  url.search = new URLSearchParams({ client_id: spec.client, redirect_uri: spec.callback, response_type: 'code',
    scope: 'openid profile', prompt: 'none', state, nonce: randomUUID(), code_challenge_method: 'S256',
    code_challenge: createHash('sha256').update(verifier).digest('base64url') }).toString();
  let response = await context.request.get(url.href, { maxRedirects: 0 });
  for (let hop = 0; hop < 6; hop++) {
    expect([302, 303].includes(response.status())).toBe(true);
    const destination = new URL(response.headers().location, response.url());
    expect([spec.origin, broker].includes(destination.origin)).toBe(true);
    if (`${destination.origin}${destination.pathname}` === spec.callback) {
      expect(destination.searchParams.get('state') === state).toBe(true);
      if (expected) { expect(Boolean(destination.searchParams.get('code'))).toBe(true); expect(destination.searchParams.has('error')).toBe(false); }
      else { expect(destination.searchParams.get('error')).toBe('login_required'); expect(destination.searchParams.has('code')).toBe(false); }
      return;
    }
    response = await context.request.get(destination.href, { maxRedirects: 0 });
  }
  throw new Error('Silent upstream authorization exceeded redirect bound');
}
export async function checkUpstreamSessions({ kind, provider, page, context, username, authorize, login, validateBroker, mark = () => {} }) {
  if (!upstreamSessionCases.includes(kind)) throw new Error('Unknown upstream session case');
  const spec = specification(provider), owner = randomUUID();
  let browserRefreshes = 0;
  const observe = request => { if (new URLSearchParams(request.postData() ?? '').get('grant_type') === 'refresh_token') browserRefreshes++; };
  page.on('request', observe);
  async function validateUpstream(tokens) {
    const value = claims(tokens.id_token);
    expect(value.iss).toBe(spec.issuer); expect([value.aud].flat()).toContain(spec.client);
    expect(value.preferred_username).toBe(username);
    const response = await context.request.get(spec.userinfo, { headers: { authorization: `Bearer ${tokens.access_token}` } });
    expect(response.status()).toBe(200); expect((await response.json()).sub === value.sub).toBe(true);
  }
  async function issue() {
    await context.clearCookies();
    const transaction = await authorize();
    const response = await context.request.post(transaction.endpoint, { form: transaction.form });
    expect(response.status()).toBe(200); const tokens = await response.json();
    expect(typeof tokens.refresh_token).toBe('string'); await validateUpstream(tokens);
    return { tokens, transaction };
  }
  async function refreshed(grant, rejected = false, downstream = false) {
    const form = { grant_type: 'refresh_token', client_id: grant.transaction.form.client_id, refresh_token: grant.tokens.refresh_token };
    if (grant.transaction.form.client_secret) form.client_secret = grant.transaction.form.client_secret;
    const response = await context.request.post(grant.transaction.endpoint, { form });
    expect(response.status()).toBe(rejected ? 400 : 200); const value = await response.json();
    if (rejected) { expect(value.error).toBe('invalid_grant'); expect(['access_token', 'refresh_token', 'id_token'].every(key => value[key] === undefined)).toBe(true); return; }
    const tokens = { ...value, refresh_token: value.refresh_token ?? grant.tokens.refresh_token };
    if (downstream) await validateBroker(tokens); else await validateUpstream(tokens);
    expect(claims(tokens.id_token).sub === claims(grant.tokens.id_token).sub).toBe(true);
    return { ...grant, tokens };
  }
  async function revokeSessions() {
    const url = spec.authentik ? `http://authentik-control:9100/oidc-sessions/${kind}` : `https://shop.magic.test:9853/sessions/${kind}`;
    const secret = readFileSync(spec.authentik ? '/ak-fixture/control-secret' : '/oidc-fixture/client-secret', 'utf8');
    expect((await context.request.post(url, { data: { action: 'revoke', owner } })).status()).toBe(403);
    const response = await context.request.post(url, { headers: { authorization: `Bearer ${secret}` }, data: { action: 'revoke', owner } });
    expect(response.status()).toBe(200); const result = await response.json();
    expect(result.revoked).toBe(true); expect(result.sessionsBefore > 0).toBe(true); expect(result.sessionsAfter).toBe(0);
    return result;
  }
  async function logout(grant) {
    const state = randomBytes(24).toString('base64url'), callback = `${spec.callback}/logout_response`;
    let returned = false;
    const observeReturn = destination => {
      expect(destination.searchParams.get('state') === state).toBe(true); returned = true;
    };
    if (spec.authentik) {
      await captureCallback(page, callback, async (destination, deliver) => {
        observeReturn(destination); await deliver('https://shop.magic.test:8543/teaching/authentik-oidc');
      });
    } else {
      // Route the initial request: redirect-chain callbacks cannot be reliably
      // intercepted with a callback-only browser route.
      await page.route(url => `${url.origin}${url.pathname}` === spec.logout, async route => {
        const response = await route.fetch({ maxRedirects: 0 });
        expect([302, 303].includes(response.status())).toBe(true);
        const destination = new URL(response.headers().location, response.url());
        expect(`${destination.origin}${destination.pathname}` === callback).toBe(true);
        observeReturn(destination);
        await route.fulfill({ contentType: 'text/html', body: '<p>Private upstream logout completed</p>' });
      });
    }
    const url = new URL(spec.logout); url.search = new URLSearchParams({ id_token_hint: grant.tokens.id_token,
      client_id: spec.client, post_logout_redirect_uri: callback, state }).toString();
    await page.goto(url.href); await expect.poll(() => returned, { timeout: 30000 }).toBe(true);
  }
  async function revokeToken(grant) {
    const form = { client_id: spec.client, client_secret: grant.transaction.form.client_secret, token: grant.tokens.refresh_token, token_type_hint: 'refresh_token' };
    for (let count = 0; count < 2; count++) expect((await context.request.post(spec.revoke, { form })).status()).toBe(200);
  }
  try {
    mark('control');
    if (kind === 'upstream-revocation-broker-boundary') {
      const tokens = await login();
      const method = spec.authentik ? 'authentik-oidc' : 'oidc';
      let grant = { tokens, transaction: { endpoint: `${broker}/realms/lesson-${method}/protocol/openid-connect/token`, form: { client_id: `${method}-spa` } } };
      grant = await refreshed(grant, false, true); await silentSso(context, spec, true);
      mark('revoke'); const result = await revokeSessions(); expect(result.logoutNotificationConfigured).toBe(false);
      // Without a configured logout notification, upstream revocation does not
      // retroactively remove the broker's independent cached session.
      mark('broker'); await refreshed(grant, false, true); await expect(page.getByTestId('lesson-user')).toHaveText(username);
      await silentSso(context, spec, false);
      mark('recovery'); await context.clearCookies(); await login();
    } else {
      let grant = await issue(); grant = await refreshed(grant); await silentSso(context, spec, true);
      mark('revoke');
      if (kind === 'upstream-rp-logout') await logout(grant);
      else if (kind === 'upstream-session-revoked') await revokeSessions();
      else await revokeToken(grant);
      mark('grants');
      if (kind !== 'upstream-token-revoked') {
        const denied = await context.request.get(spec.userinfo, { headers: { authorization: `Bearer ${grant.tokens.access_token}` } });
        expect(denied.status()).toBe(401);
      }
      await refreshed(grant, kind === 'upstream-token-revoked' || !spec.authentik);
      mark('sso'); await silentSso(context, spec, spec.authentik && kind !== 'upstream-session-revoked');
      mark('recovery'); const recovered = await issue(); await refreshed(recovered);
      await expect(page.getByTestId('lesson-user')).toHaveCount(0);
    }
    expect(browserRefreshes).toBe(0);
  } finally { page.off('request', observe); }
}
