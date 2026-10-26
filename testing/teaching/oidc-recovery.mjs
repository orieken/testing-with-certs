import { expect } from '@playwright/test';
import { oidcRecoveryKinds } from './oidc-recovery-cases.mjs';

const shop = 'https://shop.magic.test:8543';
const unavailable = route => route.fulfill({ status: 503, contentType: 'text/html',
  body: '<p>Isolated OIDC dependency unavailable</p>' });

async function navigationFault({ kind, page, capture, landing, tokenEndpoint, attempt }) {
  let faults = 0, exchanges = 0;
  page.on('request', request => { if (request.url() === tokenEndpoint) exchanges++; });
  await capture(async (url, deliver) => {
    expect(url.searchParams.has('error')).toBe(false);
    expect(Boolean(url.searchParams.get('code'))).toBe(true);
    expect(Boolean(url.searchParams.get('state'))).toBe(true);
    faults++;
    if (kind === 'callback-interrupted') return deliver(landing);
    // A controlled cancellation response for an owned, real authorization.
    // Preserve its state, removing the code before delivering access_denied.
    url.searchParams.delete('code');
    url.searchParams.set('error', 'access_denied');
    await deliver(url.href);
  });
  await attempt();
  await expect.poll(() => faults).toBe(1);
  await expect(page).toHaveURL(landing);
  if (kind === 'authorization-cancelled') await expect(page.getByRole('alert')).toBeVisible();
  expect(exchanges).toBe(0);
}

async function dependencyFault({ kind, page, tokenEndpoint, attempt, recover }) {
  let faults = 0;
  if (kind === 'logout-unavailable') {
    await recover();
    await page.route(url => url.origin === 'https://shop.magic.test:9643' && url.pathname.endsWith('/logout'), async route => {
      if (faults) return route.continue();
      faults++; await unavailable(route);
    });
    await page.getByRole('button', { name: 'Sign out of lesson', exact: true }).click();
  } else {
    await page.route(url => kind === 'provider-unavailable'
      ? ['/realms/lesson-provider/login-actions/authenticate'].includes(url.pathname) ||
        url.origin === 'https://shop.magic.test:9743' && url.pathname.startsWith('/api/v3/flows/executor/')
      : url.href === tokenEndpoint, async route => {
      const request = route.request();
      const password = new URLSearchParams(request.postData() ?? '').has('password') || /"password"\s*:/.test(request.postData() ?? '');
      if (faults || request.method() !== 'POST' || kind === 'provider-unavailable' && !password) return route.continue();
      faults++;
      if (kind === 'token-interrupted') await route.abort('connectionfailed');
      else await unavailable(route);
    });
    await attempt();
  }
  await expect.poll(() => faults).toBe(1);
  if (kind.startsWith('token-')) await expect(page.getByRole('alert')).toBeVisible();
}

export async function checkOidcRecovery(options) {
  const { kind, page, method, recover, mark = () => {} } = options;
  if (!oidcRecoveryKinds.includes(kind)) throw new Error('Unknown OIDC recovery check');
  const landing = `${shop}/teaching/${method}`;
  mark('fault');
  if (['authorization-cancelled', 'callback-interrupted'].includes(kind)) await navigationFault({ ...options, landing });
  else await dependencyFault(options);
  mark('rejection');
  await expect(page.getByTestId('lesson-user')).toHaveCount(0);
  if (kind.startsWith('token-') || kind === 'authorization-cancelled') {
    await expect(page.getByRole('button', { name: /Sign in with/ })).toBeEnabled();
  }
  // Navigation failures leave the provider document. Re-enter the application
  // without replacing the browser context or clearing its cookies/storage.
  mark('reentry');
  await page.goto(landing);
  await expect(page.getByTestId('lesson-user')).toHaveCount(0);
  const signIn = page.getByRole('button', { name: method === 'oidc' ? 'Sign in with OpenID Connect' : 'Sign in with authentik OIDC', exact: true });
  await expect(signIn).toBeEnabled();
  mark('login');
  await recover(); // Existing controls validate identity, audience and API denial.
  await expect(page.getByTestId('lesson-user')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
}
