import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { totp } from './totp.mjs';
import { otpCaseNames, otpSessionCaseNames } from './auth-matrix.mjs';
import { checkLessonToken } from './auth-lessons.mjs';

const origin = 'https://shop.magic.test:8543';
const path = '/teaching/password-otp';

// Each invocation owns its context, enrollment key, and OTP reuse window.
export async function checkPasswordOtp(browser, name, playwright) {
  if (![...otpCaseNames, ...otpSessionCaseNames].includes(name)) throw new Error('Unknown password/OTP check');
  if (otpSessionCaseNames.includes(name) !== (process.env.LAB_OTP_LIFECYCLE === '1')) throw new Error('Wrong OTP fixture phase');
  const fixtures = JSON.parse(readFileSync('/test-secrets/otp.json', 'utf8'));
  let context = await browser.newContext();
  let page = await context.newPage();
  let lastUsedStep = -1;
  async function freshPage() {
    await context.close(); context = await browser.newContext(); page = await context.newPage();
  }
  async function password(username, wrong = false) {
    await page.goto(`${origin}${path}`);
    await page.getByRole('button', { name: 'Sign in with password and code' }).click();
    await expect(page).toHaveURL(/^https:\/\/auth\.magic\.test:9443\//);
    await page.locator('#username').fill(username);
    const account = fixtures.find(value => value.username === username);
    if (!account) throw new Error('Missing password/OTP fixture account');
    await page.locator('#password').fill(wrong ? 'invalid-test-password' : account.password);
    await page.locator('#kc-login').click();
  }
  async function enroll(username) {
    await password(username);
    await page.locator('#mode-manual').click();
    const key = (await page.locator('#kc-totp-secret-key').innerText()).replace(/\s/g, '');
    await page.locator('#totp').fill(totp(key));
    if (await page.locator('#userLabel').count()) await page.locator('#userLabel').fill('Lesson test authenticator');
    await page.locator('#saveTOTPBtn').click();
    lastUsedStep = Math.floor(Date.now() / 30_000);
    await expect(page.getByTestId('otp-user')).toHaveText(username);
    return key;
  }
  async function code(key, timestamp = Date.now()) {
    if (Math.floor(timestamp / 30_000) === lastUsedStep) {
      await page.waitForTimeout(30_000 - Date.now() % 30_000 + 500); timestamp = Date.now();
    }
    await page.locator('#otp').fill(totp(key, timestamp));
    await page.locator('#kc-login').click();
    if (timestamp > Date.now() - 30_000) lastUsedStep = Math.floor(timestamp / 30_000);
  }
  const tokenEndpoint = 'https://auth.magic.test:9443/realms/magic-shop/protocol/openid-connect/token';
  let browserRefreshes = 0;
  page.on('request', request => {
    if (request.url() === tokenEndpoint && new URLSearchParams(request.postData() ?? '').get('grant_type') === 'refresh_token') browserRefreshes++;
  });
  function captureSession() {
    const response = page.waitForResponse(value => value.url() === tokenEndpoint && value.request().method() === 'POST' && value.status() === 200);
    void response.catch(() => {});
    return response.then(value => value.json());
  }
  const claims = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  async function session(username) {
    const pending = captureSession();
    const key = await enroll(username);
    const tokens = await pending;
    expect(typeof tokens.access_token).toBe('string');
    expect(typeof tokens.refresh_token).toBe('string');
    expect(tokens.expires_in).toBe(20);
    expect(tokens.refresh_expires_in > 0 && tokens.refresh_expires_in <= 45).toBe(true);
    return { key, tokens };
  }
  const refresh = (tokens, clientId = 'password-otp-spa') => context.request.post(tokenEndpoint, {
    form: { grant_type: 'refresh_token', client_id: clientId, refresh_token: tokens.refresh_token },
  });
  async function refreshed(tokens, username) {
    const response = await refresh(tokens);
    expect(response.status()).toBe(200);
    const next = await response.json();
    expect(typeof next.access_token).toBe('string');
    expect(next.access_token !== tokens.access_token).toBe(true);
    expect(claims(next.access_token).sub === claims(tokens.access_token).sub).toBe(true);
    expect(claims(next.access_token).preferred_username).toBe(username);
    await checkLessonToken(playwright, next.access_token, 'password-otp');
  }
  async function rejectedRefresh(tokens, clientId) {
    const response = await refresh(tokens, clientId);
    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.error).toBe('invalid_grant');
  }
  try {
    switch (name) {
      case 'access-token expiry clears lesson and requires both factors': {
        const username = 'otp-test-expiry';
        const { key, tokens } = await session(username);
        const remaining = claims(tokens.access_token).exp * 1000 - Date.now();
        expect(remaining > 5000).toBe(true);
        await page.waitForTimeout(Math.max(0, remaining - 3000));
        await expect(page.getByTestId('otp-user')).toHaveText(username);
        await expect(page.getByTestId('otp-user')).toHaveCount(0, { timeout: 10_000 });
        await expect(page.getByRole('button', { name: 'Sign in with password and code' })).toBeVisible();
        expect(browserRefreshes).toBe(0);
        const next = captureSession();
        await password(username);
        await expect(page.locator('#otp')).toBeVisible();
        await code(key);
        await expect(page.getByTestId('otp-user')).toHaveText(username);
        await checkLessonToken(playwright, (await next).access_token, 'password-otp');
        break;
      }
      case 'refresh preserves identity and lesson audience': {
        const username = 'otp-test-refresh';
        const { tokens } = await session(username);
        await refreshed(tokens, username);
        await expect(page.getByTestId('otp-user')).toHaveText(username);
        expect(browserRefreshes).toBe(0);
        break;
      }
      case 'logout invalidates refresh token': {
        const { tokens } = await session('otp-test-logout');
        await page.getByRole('button', { name: 'Sign out of lesson' }).click();
        await expect(page.getByRole('button', { name: 'Sign in with password and code' })).toBeVisible();
        await rejectedRefresh(tokens);
        await page.reload(); await expect(page.getByTestId('otp-user')).toHaveCount(0);
        expect(browserRefreshes).toBe(0);
        break;
      }
      case 'refresh token cannot be used by another client': {
        const username = 'otp-test-binding';
        const { tokens } = await session(username);
        await rejectedRefresh(tokens, 'passkeys-spa');
        // A successful same-token control proves the mismatch was not an expired fixture.
        await refreshed(tokens, username);
        break;
      }
      case 'expired session rejects refresh': {
        const { tokens } = await session('otp-test-session-expiry');
        await page.waitForTimeout(tokens.refresh_expires_in * 1000 + 1500);
        await rejectedRefresh(tokens);
        await expect(page.getByTestId('otp-user')).toHaveCount(0);
        expect(browserRefreshes).toBe(0);
        break;
      }
      case 'certificate-free entrance and route boundaries': {
        await page.goto(`${origin}/teaching`);
        await expect(page.getByRole('heading', { name: 'Authentication lessons', exact: true })).toBeVisible();
        for (const route of ['/api/catalog/items', '/api/customer/me', '/api/insights/sales', '/internal', '/account']) {
          expect((await page.request.get(`${origin}${route}`)).status()).toBe(404);
        }
        await expect(page.goto('https://shop.magic.test:8443/')).rejects.toThrow();
        break;
      }
      case 'enrollment and lesson audience denied at business APIs': {
        let accessToken;
        let captureFailed = false;
        page.on('response', async response => {
          if (response.url().endsWith('/protocol/openid-connect/token') && response.status() === 200) {
            try { accessToken = (await response.json()).access_token; }
            catch { captureFailed = true; }
          }
        });
        await enroll('otp-test-audience');
        await expect.poll(() => typeof accessToken === 'string' ? 'captured' : captureFailed ? 'failed' : 'waiting').toBe('captured');
        await checkLessonToken(playwright, accessToken, 'password-otp');
        break;
      }
      case 'wrong password': {
        await password('otp-test-password', true);
        await expect(page.getByText('Invalid username or password.', { exact: true })).toBeVisible();
        await expect(page.locator('#otp')).toHaveCount(0);
        break;
      }
      case 'incorrect and expired codes': {
        const key = await enroll('otp-test-codes');
        await freshPage(); await password('otp-test-codes');
        const now = Date.now();
        const accepted = new Set([-30_000, 0, 30_000].map(offset => totp(key, now + offset)));
        let wrong = Number(totp(key, now));
        do { wrong = (wrong + 1) % 1_000_000; } while (accepted.has(String(wrong).padStart(6, '0')));
        await page.locator('#otp').fill(String(wrong).padStart(6, '0'));
        await page.locator('#kc-login').click();
        await expect(page.getByText('Invalid authenticator code.', { exact: true })).toBeVisible();
        await code(key, Date.now() - 300_000);
        await expect(page.getByText('Invalid authenticator code.', { exact: true })).toBeVisible();
        await expect(page).toHaveURL(/^https:\/\/auth\.magic\.test:9443\//);
        await expect(page.getByTestId('otp-user')).toHaveCount(0);
        break;
      }
      case 'disabled user': {
        await password('otp-test-disabled');
        await expect(page.getByText('Account is disabled, contact your administrator.', { exact: true })).toBeVisible();
        await expect(page.locator('#otp')).toHaveCount(0);
        break;
      }
      case 'successful login, logout and cookie cannot skip factors': {
        const key = await enroll('otp-test-session');
        await page.route('**/protocol/openid-connect/auth?*', async route => {
          const url = new URL(route.request().url()); url.searchParams.delete('prompt');
          await route.continue({ url: url.toString() });
        }, { times: 1 });
        await password('otp-test-session');
        await expect(page.locator('#otp')).toBeVisible();
        await code(key);
        await expect(page.getByTestId('otp-user')).toHaveText('otp-test-session');
        await page.getByRole('button', { name: 'Sign out of lesson' }).click();
        await expect(page.getByRole('button', { name: 'Sign in with password and code' })).toBeVisible();
        await page.reload(); await expect(page.getByTestId('otp-user')).toHaveCount(0);
        break;
      }
      case 'fresh profile and second account isolation': {
        await enroll('otp-test-isolation');
        await freshPage(); await page.goto(`${origin}${path}`);
        await expect(page.getByTestId('otp-user')).toHaveCount(0);
        await enroll('otp-test-enroll');
        break;
      }
    }
  } finally { await context.close(); }
}
