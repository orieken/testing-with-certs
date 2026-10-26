import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import { jwksCaseNames } from '../../infra/oidc-token-fixture/cases.mjs';
const fixture = 'https://shop.magic.test:9843';
// Keep the pinned broker's default ten-second public-key fetch protection.
const refreshWindow = page => page.waitForTimeout(11000);
async function rejectedAtBroker(page, tokenEndpoint, attempt) {
  let exchanges = 0, callbacks = 0;
  const observe = request => {
    if (request.url() === tokenEndpoint) exchanges++;
    const url = new URL(request.url());
    if (url.origin === 'https://shop.magic.test:8543' && url.pathname.endsWith('/callback') && url.searchParams.has('code')) callbacks++;
  };
  page.on('request', observe);
  const response = page.waitForResponse(value => {
    const url = new URL(value.url());
    return url.origin === 'https://shop.magic.test:9643' && url.pathname.includes('/broker/') && url.pathname.endsWith('/endpoint') && value.status() >= 400;
  });
  void response.catch(() => {});
  try {
    await attempt(); await response;
    await expect(page.getByTestId('lesson-user')).toHaveCount(0);
    expect(exchanges).toBe(0); expect(callbacks).toBe(0);
  } finally { page.off('request', observe); }
}
export async function checkJwksLifecycle({ kind, page, context, provider, tokenEndpoint, login, attempt, mark = () => {} }) {
  if (!jwksCaseNames.includes(kind)) throw new Error('Unknown JWKS lifecycle check');
  const owner = randomUUID(), headers = { authorization: `Bearer ${readFileSync('/oidc-fixture/client-secret', 'utf8')}` };
  let nativeActive = false, armed = false;
  async function control(action, mode) {
    const response = await context.request.post(`${fixture}/control`, { headers, data: { provider, owner, kind, action, mode } });
    expect(response.status()).toBe(200); return response.json();
  }
  async function native(action) {
    const url = provider === 'keycloak' ? 'https://shop.magic.test:9853/keycloak' : `http://authentik-control:9100/oidc-keys/${action}`;
    const credential = provider === 'keycloak' ? headers : { authorization: `Bearer ${readFileSync('/ak-fixture/control-secret', 'utf8')}` };
    const response = await context.request.post(url, { headers: credential, data: { action, owner } });
    expect(response.status()).toBe(200); return response.json();
  }
  async function freshLogin(wait = false) {
    if (wait) await refreshWindow(page);
    await context.clearCookies(); await login();
  }
  try {
    mark('control'); nativeActive = true; expect((await native('start')).rotated).toBe(false);
    await control('arm'); armed = true;
    await freshLogin();
    const warm = await control('status');
    expect(warm.originalVerified).toBe(true); expect(warm.distinctProviderKids).toBe(1);
    if (kind === 'jwks-cached-key-outage') {
      mark('cached'); await control('jwks-mode', 'unavailable');
      expect((await context.request.get(`${fixture}/${provider}/jwks`)).status()).toBe(503);
      const before = await control('status'); await freshLogin(); const after = await control('status');
      expect(after.jwksRequests).toBe(before.jwksRequests); expect(after.tokenResponses).toBe(before.tokenResponses + 1);
      expect(after.distinctProviderKids).toBe(1); expect(after.jwksFailures).toBeGreaterThan(0);
      await control('jwks-mode', 'healthy');
    } else {
      mark('rotate'); const rotated = await native('rotate');
      expect(rotated.rotated).toBe(true); expect(rotated.activePublished).toBe(true);
      if (kind !== 'signing-key-native-rotation') {
        const mode = { 'jwks-uncached-key-outage': 'unavailable', 'jwks-malformed-response': 'malformed', 'jwks-empty-response': 'empty' }[kind];
        mark('outage'); await control('jwks-mode', mode); await refreshWindow(page); await context.clearCookies();
        await rejectedAtBroker(page, tokenEndpoint, attempt);
        mark('rejection'); const failed = await control('status');
        expect(failed.originalVerified).toBe(true); expect(failed.distinctProviderKids).toBe(2);
        expect(failed.jwksRequests).toBeGreaterThan(warm.jwksRequests); expect(failed.jwksFailures).toBeGreaterThan(0);
        await control('jwks-mode', 'healthy');
      }
      mark('recovery'); const before = await control('status'); await freshLogin(true); const after = await control('status');
      expect(after.distinctProviderKids).toBe(2); expect(after.jwksSuccesses).toBeGreaterThan(before.jwksSuccesses);
    }
    mark('restore'); expect((await native('restore')).restored).toBe(true); nativeActive = false;
    await freshLogin(true); await expect(page.getByRole('alert')).toHaveCount(0);
  } finally {
    try { if (armed) await control('release'); }
    finally { if (nativeActive) await native('restore'); }
  }
}
