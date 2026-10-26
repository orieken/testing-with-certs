import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import { upstreamIdTokenKinds } from '../../infra/oidc-token-fixture/cases.mjs';

export async function checkUpstreamIdToken({ kind, page, context, provider, tokenEndpoint, login, attempt, mark = () => {} }) {
  const fault = kind.replace('upstream-id-token-', '');
  if (!upstreamIdTokenKinds.includes(fault)) throw new Error('Unknown upstream ID-token check');
  const headers = { authorization: `Bearer ${readFileSync('/oidc-fixture/client-secret', 'utf8')}` };
  let owner;
  async function control(action, selected) {
    const response = await context.request.post('https://shop.magic.test:9843/control', {
      headers, data: { provider, owner, action, kind: selected },
    });
    expect(response.status()).toBe(200);
    return response.json();
  }
  async function arm(selected) { owner = randomUUID(); await control('arm', selected); }
  async function applied(selected) {
    const status = await control('status');
    expect(status).toEqual({ kind: selected, applied: 1, originalVerified: true });
  }
  async function release() { if (owner) { await control('release'); owner = undefined; } }
  try {
    mark('control');
    await arm('signed-control'); await login(); await applied('signed-control'); await release();
    if (fault === 'signed-control') return;
    await context.clearCookies();
    mark('fault'); await arm(fault);
    let exchanges = 0, callbacks = 0;
    const observe = request => {
      if (request.url() === tokenEndpoint) exchanges++;
      const url = new URL(request.url());
      if (url.origin === 'https://shop.magic.test:8543' && url.pathname.endsWith('/callback') && url.searchParams.has('code')) callbacks++;
    };
    page.on('request', observe);
    const rejected = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.origin === 'https://shop.magic.test:9643' && url.pathname.includes('/broker/') &&
        url.pathname.endsWith('/endpoint') && response.status() >= 400;
    });
    void rejected.catch(() => {});
    await attempt(); await rejected;
    mark('rejection'); await applied(fault);
    await expect(page.getByTestId('lesson-user')).toHaveCount(0);
    expect(exchanges).toBe(0); expect(callbacks).toBe(0);
    page.off('request', observe); await release();
    await context.clearCookies();
    mark('recovery'); await login();
    await expect(page.getByRole('alert')).toHaveCount(0);
  } finally { await release(); }
}
