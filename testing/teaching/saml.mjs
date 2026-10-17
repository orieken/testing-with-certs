import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { startLesson, captureToken, checkLessonToken, lessonOrigin } from './auth-lessons.mjs';
import { samlCaseNames } from './auth-matrix.mjs';

const checks = new Map();
const defineCheck = (name, check) => checks.set(name, check);
const passwordFor = name => {
  const users = JSON.parse(readFileSync('/test-secrets/auth-users.json', 'utf8'));
  const account = users.find(value => value.username === name);
  if (!account) throw new Error('Missing SAML fixture account');
  return account.password;
};

async function providerLogin(page, method, kind = 'user') {
  const title = method === 'oidc' ? 'Sign in with OpenID Connect' : 'Sign in with SAML';
  await startLesson(page, method, title);
  await expect(page).toHaveURL(/^https:\/\/shop\.magic\.test:9643\/realms\/lesson-provider\//);
  const username = `${method}-test-${kind}`;
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(passwordFor(username));
  await page.locator('#kc-login').click();
}

for (const method of ['saml']) {
  defineCheck(`${method}:login-audience-and-logout`, async ({ page, playwright }) => {
    const token = captureToken(page, `lesson-${method}`);
    await providerLogin(page, method);
    await expect(page.getByTestId('lesson-user')).toHaveText(`${method}-test-user`);
    await checkLessonToken(playwright, await token, method);
    await page.getByRole('button', { name: 'Sign out of lesson' }).click();
    await expect(page.getByRole('button', { name: method === 'oidc' ? 'Sign in with OpenID Connect' : 'Sign in with SAML' })).toBeVisible();
  });
  defineCheck(`${method}:disabled-provider-user`, async ({ page }) => {
    await providerLogin(page, method, 'disabled');
    await expect(page.getByText('Account is disabled, contact your administrator.', { exact: true })).toBeVisible();
    await expect(page.getByTestId('lesson-user')).toHaveCount(0);
  });
  defineCheck(`${method}:callback-state-rejection`, async ({ page }) => {
    await page.goto(`${lessonOrigin}/teaching/${method}/callback?code=invalid-fixture-code&state=unmatched-fixture-state`);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByTestId('lesson-user')).toHaveCount(0);
  });
  defineCheck(`${method}:cross-protocol-provider-rejection`, async ({ page }) => {
    const url = new URL(`https://shop.magic.test:9643/realms/lesson-${method}/protocol/openid-connect/auth`);
    url.search = new URLSearchParams({ client_id: `${method}-spa`, response_type: 'code', scope: 'openid',
      redirect_uri: `${lessonOrigin}/teaching/${method}/callback`, state: 'isolated-provider-test',
      code_challenge_method: 'S256', code_challenge: 'a'.repeat(43), kc_idp_hint: method === 'oidc' ? 'lesson-saml' : 'lesson-oidc' }).toString();
    await page.goto(url.toString());
    await expect(page.locator('#kc-error-message')).toBeVisible();
    expect(new URL(page.url()).origin).toBe('https://shop.magic.test:9643');
  });
  defineCheck(`${method}:broker-state-rejection`, async ({ page }) => {
    await page.goto(`https://shop.magic.test:9643/realms/lesson-${method}/broker/lesson-${method}/endpoint?state=unmatched-fixture-state&code=invalid-fixture-code`);
    await expect(page.locator('#kc-error-message')).toBeVisible();
    await expect(page.getByTestId('lesson-user')).toHaveCount(0);
  });
}

defineCheck('saml:modified-signed-response', async ({ page }) => {
  let modified = false;
  await page.route('**/realms/lesson-saml/broker/lesson-saml/endpoint*', async route => {
    const body = new URLSearchParams(route.request().postData() ?? '');
    if (body.has('SAMLResponse')) {
      let xml = Buffer.from(body.get('SAMLResponse'), 'base64').toString();
      // Alter signed content while retaining its original signature.
      xml = xml.replace(/(<(?:\w+:)?NameID\b[^>]*>)[^<]+/, '$1tampered-fixture-user');
      body.set('SAMLResponse', Buffer.from(xml).toString('base64'));
      modified = true;
      await route.continue({ postData: body.toString() });
    } else await route.continue();
  });
  await providerLogin(page, 'saml');
  await expect.poll(() => modified).toBe(true);
  await expect(page.locator('#kc-error-message')).toBeVisible();
  await expect(page.getByTestId('lesson-user')).toHaveCount(0);
});

defineCheck('saml:response-replay', async ({ page }) => {
  let assertion;
  page.on('request', request => {
    if (request.url().includes('/realms/lesson-saml/broker/lesson-saml/endpoint') &&
        request.method() === 'POST' && new URLSearchParams(request.postData() ?? '').has('SAMLResponse')) {
      assertion = { url: request.url(), body: request.postData() };
    }
  });
  await providerLogin(page, 'saml');
  await expect(page.getByTestId('lesson-user')).toHaveText('saml-test-user');
  expect(typeof assertion?.body).toBe('string');
  const replay = await page.request.post(assertion.url, { data: assertion.body,
    headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  expect(replay.status()).toBe(400);
});

for (const variant of ['control', 'wrong-audience', 'wrong-recipient', 'expired']) {
  defineCheck(`saml:signed-${variant}`, async ({ page, playwright }) => {
    const { resignSamlResponse } = await import('./saml-fixture.mjs');
    const key = { privateKey: readFileSync('/saml-fixture/private.pem', 'utf8'),
      certificate: readFileSync('/saml-fixture/certificate.pem', 'utf8') };
    let transformed = 0;
    let tokenIssued = false;
    page.on('response', response => {
      if (response.url().includes('/realms/lesson-saml/protocol/openid-connect/token') && response.status() === 200) tokenIssued = true;
    });
    await page.route('**/realms/lesson-saml/broker/lesson-saml/endpoint*', async route => {
      const body = new URLSearchParams(route.request().postData() ?? '');
      if (body.has('SAMLResponse')) {
        // Neither the assertion nor signing material enters assertions or reporter diagnostics.
        const xml = resignSamlResponse(Buffer.from(body.get('SAMLResponse'), 'base64').toString(), variant, key);
        body.set('SAMLResponse', Buffer.from(xml).toString('base64'));
        transformed++;
        await route.continue({ postData: body.toString() });
      } else await route.continue();
    });
    const token = variant === 'control' ? captureToken(page, 'lesson-saml') : undefined;
    await providerLogin(page, 'saml');
    await expect.poll(() => transformed).toBe(1);
    if (variant === 'control') {
      await expect(page.getByTestId('lesson-user')).toHaveText('saml-test-user');
      await checkLessonToken(playwright, await token, 'saml');
    } else {
      await expect(page.locator('#kc-error-message')).toBeVisible();
      await expect(page.getByTestId('lesson-user')).toHaveCount(0);
      expect(new URL(page.url()).pathname).toBe('/realms/lesson-saml/broker/lesson-saml/endpoint');
      expect(tokenIssued).toBe(false);
    }
  });
}

// Every invocation owns its browser context, assertions, and signing material.
export async function checkSaml(browser, name, playwright) {
  if (!samlCaseNames.includes(name) || !checks.has(name)) throw new Error('Unknown SAML check');
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await checks.get(name)({ page, playwright });
  } finally { await context.close(); }
}
