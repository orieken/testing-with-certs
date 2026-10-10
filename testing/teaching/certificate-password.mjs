import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash, randomBytes, createPublicKey, verify } from 'node:crypto';

const shop = 'https://shop.magic.test:8443';
const auth = 'https://auth.magic.test:9443';
const issuer = `${auth}/realms/magic-shop`;
const lesson = '/teaching/certificate-password';
const passwords = JSON.parse(readFileSync('/test-secrets/passwords.json', 'utf8'));
const identities = JSON.parse(readFileSync('/work/seed/identities.json', 'utf8'));
const password = username => passwords.find(entry => entry.username === username).password;

async function contextFor(browser, directory, cookies) {
  const context = await browser.newContext({ ignoreHTTPSErrors: false,
    clientCertificates: directory ? [shop, auth].map(origin => ({ origin, certPath: `${directory}/cert.pem`, keyPath: `${directory}/key.pem` })) : [],
  });
  context.setDefaultTimeout(12_000);
  context.setDefaultNavigationTimeout(20_000);
  if (cookies) await context.addCookies(cookies);
  return context;
}

function authorization() {
  const verifier = randomBytes(32).toString('base64url');
  const url = new URL(`${issuer}/protocol/openid-connect/auth`);
  for (const [key, value] of Object.entries({ response_type: 'code', client_id: 'certificate-password-spa', redirect_uri: `${shop}${lesson}/callback`,
    scope: 'openid profile', code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', state: randomBytes(16).toString('hex') })) url.searchParams.set(key, value);
  return url.href;
}

async function openLesson(page) {
  await page.goto(`${shop}${lesson}`);
  await page.getByRole('button', { name: 'Sign in with certificate and password' }).click();
  await expect(page.locator('input[type=password]')).toBeVisible();
  expect(new URL(page.url()).origin).toBe(auth);
  await expect(page.locator('input[name=username]')).toHaveCount(0);
}

async function submit(page, value) {
  await page.locator('input[type=password]').fill(value);
  await page.locator('#kc-login').click();
}

async function accepted(context, page, username) {
  const response = page.waitForResponse(response => response.url() === `${issuer}/protocol/openid-connect/token` && response.request().method() === 'POST');
  void response.catch(() => {});
  await submit(page, password(username));
  await expect(page.getByTestId('teaching-user')).toHaveText(username);
  const result = await (await response).json();
  const token = result.access_token;
  const [headerPart, payloadPart, signature] = token.split('.');
  const header = JSON.parse(Buffer.from(headerPart, 'base64url'));
  const claims = JSON.parse(Buffer.from(payloadPart, 'base64url'));
  const jwks = await (await context.request.get(`${issuer}/protocol/openid-connect/certs`, { timeout: 10_000 })).json();
  const key = jwks.keys.find(entry => entry.kid === header.kid);
  expect(header.alg).toBe('RS256');
  expect(verify('RSA-SHA256', Buffer.from(`${headerPart}.${payloadPart}`), createPublicKey({ key, format: 'jwk' }), Buffer.from(signature, 'base64url'))).toBe(true);
  const identity = identities.find(entry => entry.username === username);
  expect(claims.iss).toBe(issuer);
  expect(claims.azp).toBe('certificate-password-spa');
  expect(claims.sub).toBe(identity.sub);
  expect(claims.cert_identity).toBe(identity.certIdentity);
  expect(claims.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  for (const audience of ['catalog-api', 'customer-api', 'insights-api']) expect(claims.aud).toContain(audience);
  await expect(page.getByTestId('teaching-subject')).toHaveText(identity.sub);
  await expect(page.getByTestId('teaching-certificate')).toHaveText(identity.certIdentity);
  // Business APIs retain their shop-spa client allowlist. The lesson displays identity only.
  const api = await context.request.get(`${shop}/api/customer/me`, { headers: { authorization: `Bearer ${token}` }, timeout: 10_000 });
  expect(api.status()).toBe(403);
  const stored = await page.evaluate(() => [...Object.values(localStorage), ...Object.values(sessionStorage)]);
  expect(stored.some(value => value.includes(token))).toBe(false);
  return token;
}

export async function checkCertificatePassword(browser, kind) {
  const context = await contextFor(browser, '/identity-customer');
  try {
    const page = await context.newPage();
    if (kind === 'success') {
      await openLesson(page);
      await accepted(context, page, 'customer-waterdeep');
    } else if (kind === 'wrong-password') {
      await openLesson(page);
      await submit(page, randomBytes(32).toString('hex'));
      await expect(page.getByText('Invalid password.', { exact: true })).toBeVisible();
      expect(new URL(page.url()).origin).toBe(auth);
      expect(new URL(page.url()).searchParams.has('code')).toBe(false);
    } else if (kind === 'cookies') {
      await openLesson(page);
      await accepted(context, page, 'customer-waterdeep');
      await page.goto(shop);
      const shopResponse = page.waitForResponse(response => response.url() === `${issuer}/protocol/openid-connect/token` && response.request().method() === 'POST');
      void shopResponse.catch(() => {});
      await page.getByRole('button', { name: 'Sign in with certificate', exact: true }).click();
      await expect(page.getByTestId('signed-in-user')).toContainText('customer-waterdeep');
      const token = (await (await shopResponse).json()).access_token;
      expect((await context.request.get(`${shop}/api/customer/me`, { headers: { authorization: `Bearer ${token}` }, timeout: 10_000 })).status()).toBe(200);
      const cookies = await context.cookies();
      await page.goto(authorization()); // No prompt=login: test the server flow itself.
      await expect(page.locator('input[type=password]')).toBeVisible();
      expect(new URL(page.url()).searchParams.has('code')).toBe(false);
      const other = await contextFor(browser, '/identity-shopkeeper', cookies);
      try {
        const second = await other.newPage();
        await openLesson(second);
        await submit(second, password('customer-waterdeep'));
        await expect(second.getByText('Invalid password.', { exact: true })).toBeVisible();
        await submit(second, password('shopkeeper'));
        await expect(second.getByText('You are already authenticated as different user', { exact: false })).toBeVisible();
        expect(new URL(second.url()).searchParams.has('code')).toBe(false);
        const fresh = await contextFor(browser, '/identity-shopkeeper');
        try {
          const freshPage = await fresh.newPage();
          await openLesson(freshPage);
          await accepted(fresh, freshPage, 'shopkeeper');
        } finally { await fresh.close(); }
        const mismatch = await other.request.get(`${shop}/api/customer/me`, { headers: { authorization: `Bearer ${token}` }, timeout: 10_000 });
        expect(mismatch.status()).toBe(403);
      } finally { await other.close(); }
      const absent = await contextFor(browser, undefined, cookies);
      try {
        const without = await absent.newPage();
        await without.goto(authorization()).catch(() => {});
        expect(new URL(without.url()).searchParams.has('code')).toBe(false);
        await expect(without.locator('input[type=password]')).toHaveCount(0);
      } finally { await absent.close(); }
    } else if (kind === 'shop') {
      await page.goto(shop);
      await page.getByRole('button', { name: 'Sign in with certificate', exact: true }).click();
      await expect(page.getByTestId('signed-in-user')).toContainText('customer-waterdeep');
      await expect(page.locator('input[type=password]')).toHaveCount(0);
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Sign in with certificate', exact: true })).toBeVisible();
    } else {
      const directory = { missing: undefined, wrong: '/identity-service', disabled: '/identity-disabled', unknown: '/identity-unknown', unconfigured: '/identity-second-customer' }[kind];
      if (!['missing', 'wrong', 'disabled', 'unknown', 'unconfigured'].includes(kind)) throw new Error('Unknown teaching check');
      const denied = await contextFor(browser, directory);
      try {
        const negative = await denied.newPage();
        let issued = false;
        negative.on('request', request => { if (new URL(request.url()).searchParams.has('code')) issued = true; });
        await negative.goto(authorization()).catch(() => {});
        expect(issued).toBe(false);
        await expect(negative.locator('input[type=password]')).toHaveCount(0);
        if (kind === 'missing' || kind === 'wrong') {
          await expect(denied.request.get(shop, { timeout: 10_000 })).rejects.toThrow();
        }
      } finally { await denied.close(); }
    }
  } finally { await context.close(); }
}
