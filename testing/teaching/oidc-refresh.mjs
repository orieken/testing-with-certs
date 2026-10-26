import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import { refreshCaseNames } from './oidc-refresh-cases.mjs';
const claims = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
// All response bodies, authorization codes and tokens remain inside this scenario.
export async function checkRefreshRotation({ kind, provider, page, context, authorize, validate, mark = () => {} }) {
  if (!refreshCaseNames.includes(kind)) throw new Error('Unknown refresh rotation case');
  const upstream = kind.startsWith('upstream-'), authentik = upstream && provider === 'authentik';
  const owner = randomUUID();
  const target = upstream ? 'keycloak' : provider === 'authentik' ? 'authentik-broker' : 'broker';
  const url = authentik ? 'http://authentik-control:9100/oidc-refresh/' : `https://shop.magic.test:9853/refresh/${target}`;
  const credential = readFileSync(authentik ? '/ak-fixture/control-secret' : '/oidc-fixture/client-secret', 'utf8');
  async function policy(action) {
    const response = await context.request.post(authentik ? url + action : url, { headers: { authorization: `Bearer ${credential}` }, data: { owner, action } });
    expect(response.status()).toBe(200); return response.json();
  }
  let active = false, browserRefreshes = 0;
  const observe = request => { if (request.method() === 'POST' && new URLSearchParams(request.postData() ?? '').get('grant_type') === 'refresh_token') browserRefreshes++; };
  page.on('request', observe);
  async function issue() {
    await context.clearCookies();
    const transaction = await authorize(upstream);
    const response = await context.request.post(transaction.endpoint, { form: transaction.form });
    expect(response.status()).toBe(200);
    const tokens = await response.json();
    expect(typeof tokens.refresh_token).toBe('string'); expect(tokens.refresh_token.length > 20).toBe(true);
    await validate(tokens, upstream);
    return { tokens, transaction };
  }
  async function refresh(tokens, transaction, rejected = false) {
    const form = { grant_type: 'refresh_token', client_id: transaction.form.client_id, refresh_token: tokens.refresh_token };
    if (transaction.form.client_secret) form.client_secret = transaction.form.client_secret;
    const response = await context.request.post(transaction.endpoint, { form });
    expect(response.status()).toBe(rejected ? 400 : 200);
    const next = await response.json();
    if (rejected) {
      expect(next.error).toBe('invalid_grant'); expect(next.access_token === undefined && next.refresh_token === undefined).toBe(true);
      return;
    }
    expect(typeof next.refresh_token).toBe('string'); expect(next.refresh_token !== tokens.refresh_token).toBe(true);
    await validate(next, upstream);
    const before = claims(tokens.id_token ?? tokens.access_token), after = claims(next.id_token ?? next.access_token);
    expect(after.sub === before.sub).toBe(true);
    return next;
  }
  try {
    mark('policy'); active = true; expect((await policy('start')).rotation).toBe(true);
    mark('control'); const { tokens, transaction } = await issue();
    const next = await refresh(tokens, transaction);
    if (kind.endsWith('-rotation')) {
      mark('rotation'); await refresh(next, transaction);
    } else {
      mark('reuse'); const events = authentik ? (await policy('status')).reuseEvents : undefined;
      await refresh(tokens, transaction, true);
      if (authentik) {
        expect((await policy('status')).reuseEvents).toBeGreaterThan(events);
        // This pinned provider detects revoked-token reuse and keeps the child valid.
        await refresh(next, transaction);
      } else await refresh(next, transaction, true);
      mark('recovery'); const recovered = await issue(); await refresh(recovered.tokens, recovered.transaction);
    }
    await expect(page.getByTestId('lesson-user')).toHaveCount(0);
    expect(browserRefreshes).toBe(0);
    mark('restore'); expect((await policy('restore')).restored).toBe(true); active = false;
  } finally { page.off('request', observe); if (active) await policy('restore'); }
}
