import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { totp } from '../teaching/totp.mjs';

const origin = 'https://shop.magic.test:8543';
const path = '/teaching/password-otp';
const fixtures = JSON.parse(readFileSync('/test-secrets/otp.json', 'utf8'));
let secret;
let lastUsedStep = -1;

async function password(page, username = 'otp-test-user', wrong = false) {
  await page.goto(`${origin}${path}`);
  await page.getByRole('button', { name: 'Sign in with password and code' }).click();
  await expect(page).toHaveURL(/^https:\/\/auth\.magic\.test:9443\//);
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(wrong ? 'invalid-test-password' : fixtures.find(value => value.username === username).password);
  await page.locator('#kc-login').click();
}

async function enroll(page) {
  // Enrollment key and submitted codes never enter assertions, traces or reports.
  await page.locator('#mode-manual').click();
  const key = (await page.locator('#kc-totp-secret-key').innerText()).replace(/\s/g, '');
  await page.locator('#totp').fill(totp(key));
  if (await page.locator('#userLabel').count()) await page.locator('#userLabel').fill('Playwright lesson authenticator');
  await page.locator('#saveTOTPBtn').click();
  lastUsedStep = Math.floor(Date.now() / 30_000);
  return key;
}

async function code(page, key, timestamp = Date.now()) {
  if (Math.floor(timestamp / 30_000) === lastUsedStep) {
    await page.waitForTimeout(30_000 - Date.now() % 30_000 + 500);
    timestamp = Date.now();
  }
  await page.locator('#otp').fill(totp(key, timestamp));
  await page.locator('#kc-login').click();
  if (timestamp > Date.now() - 30_000) lastUsedStep = Math.floor(timestamp / 30_000);
}

test.describe.serial('Password and OTP', () => {
  test('certificate-free entrance and route boundaries', async ({ page }) => {
    await page.goto(`${origin}/teaching`);
    await expect(page.getByRole('heading', { name: 'Authentication lessons', exact: true })).toBeVisible();
    for (const route of ['/api/catalog/items', '/api/customer/me', '/api/insights/sales', '/internal', '/account']) {
      expect((await page.request.get(`${origin}${route}`)).status()).toBe(404);
    }
    await expect(page.goto('https://shop.magic.test:8443/')).rejects.toThrow();
  });

  test('enrollment and lesson audience denied at business APIs', async ({ page, playwright }) => {
    let accessToken;
    page.on('response', async response => {
      if (response.url().endsWith('/protocol/openid-connect/token') && response.status() === 200) {
        accessToken = (await response.json()).access_token;
      }
    });
    await password(page);
    secret = await enroll(page);
    await expect(page.getByTestId('otp-user')).toHaveText('otp-test-user');
    await expect.poll(() => typeof accessToken).toBe('string');
    const claims = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString());
    expect(claims.azp).toBe('password-otp-spa');
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    expect(audiences).toContain('password-otp-lesson');
    for (const audience of ['catalog-api', 'customer-api', 'insights-api']) expect(audiences).not.toContain(audience);
    const api = await playwright.request.newContext({ clientCertificates: [{ origin: 'https://shop.magic.test:8443',
      certPath: '/identity-customer/cert.pem', keyPath: '/identity-customer/key.pem' }] });
    try {
      for (const route of ['/api/catalog/items', '/api/customer/me', '/api/insights/sales']) {
        expect((await api.get(`https://shop.magic.test:8443${route}`, { headers: { authorization: `Bearer ${accessToken}` } })).status()).toBe(401);
      }
    } finally { await api.dispose(); }
  });

  test('wrong password', async ({ page }) => {
    await password(page, 'otp-test-user', true);
    await expect(page.getByText('Invalid username or password.', { exact: true })).toBeVisible();
    await expect(page.locator('#otp')).toHaveCount(0);
  });

  test('incorrect and expired codes', async ({ page }) => {
    await password(page);
    const wrong = (Number(totp(secret)) + 123456) % 1_000_000;
    await page.locator('#otp').fill(String(wrong).padStart(6, '0'));
    await page.locator('#kc-login').click();
    await expect(page.getByText('Invalid authenticator code.', { exact: true })).toBeVisible();
    await code(page, secret, Date.now() - 300_000);
    await expect(page.getByText('Invalid authenticator code.', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/^https:\/\/auth\.magic\.test:9443\//);
  });

  test('disabled user', async ({ page }) => {
    await password(page, 'otp-test-disabled');
    await expect(page.getByText('Account is disabled, contact your administrator.', { exact: true })).toBeVisible();
    await expect(page.locator('#otp')).toHaveCount(0);
  });

  test('successful login, logout and cookie cannot skip factors', async ({ page }) => {
    await password(page);
    await code(page, secret);
    await expect(page.getByTestId('otp-user')).toHaveText('otp-test-user');
    // A new authorization request with the same SSO cookies still requires password and OTP.
    await page.route('**/protocol/openid-connect/auth?*', async route => {
      const url = new URL(route.request().url());
      url.searchParams.delete('prompt');
      await route.continue({ url: url.toString() });
    }, { times: 1 });
    await password(page);
    await expect(page.locator('#otp')).toBeVisible();
    await code(page, secret);
    await expect(page.getByTestId('otp-user')).toHaveText('otp-test-user');
    await page.getByRole('button', { name: 'Sign out of lesson' }).click();
    await expect(page.getByRole('button', { name: 'Sign in with password and code' })).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('otp-user')).toHaveCount(0);
  });

  test('fresh profile and second account isolation', async ({ page }) => {
    await page.goto(`${origin}${path}`);
    await expect(page.getByTestId('otp-user')).toHaveCount(0);
    await password(page, 'otp-test-enroll');
    await enroll(page);
    await expect(page.getByTestId('otp-user')).toHaveText('otp-test-enroll');
  });
});
