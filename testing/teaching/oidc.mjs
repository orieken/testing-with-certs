import { checkShortAccessLifetime } from './lesson-token-lifetime.mjs';
import { withAuthRecording } from './auth-recording.mjs';
import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { startLesson, captureToken, checkLessonToken, lessonOrigin } from './auth-lessons.mjs';
import { oidcCaseNames, oidcSessionCaseNames } from './auth-matrix.mjs';

// A scenario owns its context; credentials and tokens never enter reports.
async function runcheckOidc(browser, name, playwright) {
  if (![...oidcCaseNames, ...oidcSessionCaseNames].includes(name)) throw new Error('Unknown OIDC check');
  if (oidcSessionCaseNames.includes(name) !== (process.env.LAB_AUTH_SUITE === 'oidc-lifecycle')) throw new Error('Wrong OIDC fixture phase');
  const tokenEndpoint = 'https://shop.magic.test:9643/realms/lesson-oidc/protocol/openid-connect/token';
  const providerEndpoint = 'https://shop.magic.test:9643/realms/lesson-provider/protocol/openid-connect/auth';
  let browserRefreshes = 0;
  let providerAuthorizations = 0;
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('request', request => {
    if (request.url().startsWith(`${providerEndpoint}?`)) providerAuthorizations++;
    if (request.url() === tokenEndpoint && new URLSearchParams(request.postData() ?? '').get('grant_type') === 'refresh_token') browserRefreshes++;
  });
  async function providerLogin(kind = 'user', allowSso = false) {
    const users = JSON.parse(readFileSync('/test-secrets/auth-users.json', 'utf8'));
    const username = `oidc-test-${kind}`;
    const account = users.find(value => value.username === username);
    if (!account) throw new Error('Missing OIDC fixture account');
    await startLesson(page, 'oidc', 'Sign in with OpenID Connect');
    if (allowSso) {
      await expect(page.locator('#username:visible, #password:visible').or(page.getByTestId('lesson-user')).first()).toBeVisible();
      if (await page.getByTestId('lesson-user').isVisible()) return;
    }
    await expect(page).toHaveURL(/^https:\/\/shop\.magic\.test:9643\/realms\/lesson-provider\//);
    if (!allowSso || await page.locator('#username').isVisible()) await page.locator('#username').fill(username);
    else {
      await expect(page.locator('#kc-attempted-username')).toHaveAttribute('readonly', '');
      await expect(page.locator('#kc-attempted-username')).toHaveValue(username);
      console.log('OIDC provider reauthentication: password-only form verified.');
    }
    await page.locator('#password').fill(account.password);
    await page.locator('#kc-login').click();
  }
  const claims = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  async function session(kind, allowSso = false) {
    const pending = page.waitForResponse(value => value.url() === tokenEndpoint && value.request().method() === 'POST' && value.status() === 200);
    void pending.catch(() => {});
    const before = providerAuthorizations;
    await providerLogin(kind, allowSso);
    await expect(page.getByTestId('lesson-user')).toHaveText(`oidc-test-${kind}`);
    expect(providerAuthorizations > before).toBe(true);
    const tokens = await (await pending).json();
    expect(typeof tokens.access_token).toBe('string');
    expect(typeof tokens.refresh_token).toBe('string');
    checkShortAccessLifetime(tokens);
    expect(tokens.refresh_expires_in > 0 && tokens.refresh_expires_in <= 45).toBe(true);
    expect(claims(tokens.access_token).preferred_username).toBe(`oidc-test-${kind}`);
    await checkLessonToken(playwright, tokens.access_token, 'oidc');
    return tokens;
  }
  const refresh = (tokens, clientId = 'oidc-spa') => context.request.post(tokenEndpoint, {
    form: { grant_type: 'refresh_token', client_id: clientId, refresh_token: tokens.refresh_token },
  });
  async function refreshed(tokens, kind) {
    const response = await refresh(tokens);
    expect(response.status()).toBe(200);
    const next = await response.json();
    expect(typeof next.access_token).toBe('string');
    expect(next.access_token !== tokens.access_token).toBe(true);
    expect(claims(next.access_token).sub === claims(tokens.access_token).sub).toBe(true);
    expect(claims(next.access_token).preferred_username).toBe(`oidc-test-${kind}`);
    await checkLessonToken(playwright, next.access_token, 'oidc');
  }
  async function rejectedRefresh(tokens, clientId) {
    const response = await refresh(tokens, clientId);
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe('invalid_grant');
  }
  try {
    switch (name) {
      case 'oidc:access-expiry-reenters-federation': {
        const tokens = await session('expiry');
        const remaining = claims(tokens.access_token).exp * 1000 - Date.now();
        expect(remaining > 5000).toBe(true);
        await page.waitForTimeout(Math.max(0, remaining - 3000));
        await expect(page.getByTestId('lesson-user')).toHaveText('oidc-test-expiry');
        await expect(page.getByTestId('lesson-user')).toHaveCount(0, { timeout: 10_000 });
        await expect(page.getByRole('button', { name: 'Sign in with OpenID Connect' })).toBeVisible();
        expect(browserRefreshes).toBe(0);
        // Provider SSO cookies may be reused; require a real new provider roundtrip either way.
        const next = await session('expiry', true);
        expect(claims(next.access_token).sub === claims(tokens.access_token).sub).toBe(true);
        break;
      }
      case 'oidc:refresh-preserves-identity': {
        const tokens = await session('refresh');
        await refreshed(tokens, 'refresh');
        await expect(page.getByTestId('lesson-user')).toHaveText('oidc-test-refresh');
        expect(browserRefreshes).toBe(0);
        break;
      }
      case 'oidc:logout-invalidates-refresh': {
        const tokens = await session('logout');
        await page.getByRole('button', { name: 'Sign out of lesson' }).click();
        await expect(page.getByRole('button', { name: 'Sign in with OpenID Connect' })).toBeVisible();
        await rejectedRefresh(tokens);
        await page.reload(); await expect(page.getByTestId('lesson-user')).toHaveCount(0);
        expect(browserRefreshes).toBe(0);
        break;
      }
      case 'oidc:refresh-client-binding': {
        const tokens = await session('binding');
        await rejectedRefresh(tokens, 'account-console');
        // Same-token successful control excludes an expired fixture as the rejection cause.
        await refreshed(tokens, 'binding');
        break;
      }
      case 'oidc:session-expiry-rejects-refresh': {
        const tokens = await session('session-expiry');
        await page.waitForTimeout(tokens.refresh_expires_in * 1000 + 1500);
        await rejectedRefresh(tokens);
        await expect(page.getByTestId('lesson-user')).toHaveCount(0);
        expect(browserRefreshes).toBe(0);
        break;
      }
      case 'oidc:login-audience-and-logout': {
        const token = captureToken(page, 'lesson-oidc');
        await providerLogin();
        await expect(page.getByTestId('lesson-user')).toHaveText('oidc-test-user');
        await checkLessonToken(playwright, await token, 'oidc');
        await page.getByRole('button', { name: 'Sign out of lesson' }).click();
        await expect(page.getByRole('button', { name: 'Sign in with OpenID Connect' })).toBeVisible();
        break;
      }
      case 'oidc:disabled-provider-user': {
        await providerLogin('disabled');
        await expect(page.getByText('Account is disabled, contact your administrator.', { exact: true })).toBeVisible();
        await expect(page.getByTestId('lesson-user')).toHaveCount(0);
        break;
      }
      case 'oidc:callback-state-rejection': {
        await page.goto(`${lessonOrigin}/teaching/oidc/callback?code=invalid-fixture-code&state=unmatched-fixture-state`);
        await expect(page.getByRole('alert')).toBeVisible();
        await expect(page.getByTestId('lesson-user')).toHaveCount(0);
        break;
      }
      case 'oidc:cross-protocol-provider-rejection': {
        const url = new URL('https://shop.magic.test:9643/realms/lesson-oidc/protocol/openid-connect/auth');
        url.search = new URLSearchParams({ client_id: 'oidc-spa', response_type: 'code', scope: 'openid',
          redirect_uri: `${lessonOrigin}/teaching/oidc/callback`, state: 'isolated-provider-test',
          code_challenge_method: 'S256', code_challenge: 'a'.repeat(43), kc_idp_hint: 'lesson-saml' }).toString();
        await page.goto(url.toString());
        await expect(page.locator('#kc-error-message')).toBeVisible();
        expect(new URL(page.url()).origin).toBe('https://shop.magic.test:9643');
        break;
      }
      case 'oidc:broker-state-rejection': {
        await page.goto('https://shop.magic.test:9643/realms/lesson-oidc/broker/lesson-oidc/endpoint?state=unmatched-fixture-state&code=invalid-fixture-code');
        await expect(page.locator('#kc-error-message')).toBeVisible();
        await expect(page.getByTestId('lesson-user')).toHaveCount(0);
        break;
      }
    }
  } finally { await context.close(); }
}

export async function checkOidc(browser, name, playwright) {
  return withAuthRecording(browser, playwright, name, 'oidc', (recorded, runtime) => runcheckOidc(recorded, name, runtime));
}
