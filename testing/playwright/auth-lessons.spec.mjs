import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { startLesson, captureToken, checkLessonToken, virtualAuthenticator, lessonOrigin } from '../teaching/auth-lessons.mjs';

const users = JSON.parse(readFileSync('/test-secrets/auth-users.json', 'utf8'));
const passwordFor = name => users.find(value => value.username === name).password;
let passkeyCredentials;

async function passkeyName(page, name = 'passkeys-test-user') {
  await startLesson(page, 'passkeys', 'Sign in with a passkey');
  await page.locator('#username').fill(name);
  await page.locator('#kc-login').click();
}

test.describe.serial('Passkeys', () => {
  test('passkeys:enrollment', async ({ page, context, playwright }) => {
    page.on('dialog', dialog => dialog.accept('Lesson test passkey'));
    const authenticator = await virtualAuthenticator(context, page);
    const token = captureToken(page);
    await startLesson(page, 'passkeys/enroll', 'Enroll a passkey');
    await page.locator('#username').fill('passkeys-test-user');
    await page.locator('#password').fill(passwordFor('passkeys-test-user'));
    await page.locator('#kc-login').click();
    await page.locator('#registerWebAuthn').click();
    await expect(page.getByTestId('lesson-user')).toHaveText('passkeys-test-user');
    await checkLessonToken(playwright, await token, 'passkeys-enroll');
    passkeyCredentials = await authenticator.credentials();
    expect(passkeyCredentials.length).toBe(1);
    expect(passkeyCredentials[0].rpId).toBe('auth.magic.test');
  });

  test('passkeys:login-and-logout', async ({ page, context, playwright }) => {
    await virtualAuthenticator(context, page, passkeyCredentials);
    const token = captureToken(page);
    await passkeyName(page);
    await expect(page.locator('#password')).toHaveCount(0);
    await page.locator('#authenticateWebAuthnButton').click();
    await expect(page.getByTestId('lesson-user')).toHaveText('passkeys-test-user');
    await checkLessonToken(playwright, await token, 'passkeys');
    await page.getByRole('button', { name: 'Sign out of lesson' }).click();
    await expect(page.getByRole('button', { name: 'Sign in with a passkey' })).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('lesson-user')).toHaveCount(0);
  });

  test('passkeys:missing-credential', async ({ page, context }) => {
    await virtualAuthenticator(context, page);
    await passkeyName(page);
    await page.locator('#authenticateWebAuthnButton').click();
    await expect(page.locator('#kc-error-message, #kc-feedback-text, #kc-error-credential-form').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('lesson-user')).toHaveCount(0);
  });

  test('passkeys:invalid-signature', async ({ page, context }) => {
    await virtualAuthenticator(context, page, passkeyCredentials);
    await page.route('**/login-actions/authenticate?*', async route => {
      const body = new URLSearchParams(route.request().postData() ?? '');
      if (body.has('signature')) {
        const bytes = Buffer.from(body.get('signature'), 'base64url');
        bytes[bytes.length - 1] ^= 1;
        body.set('signature', bytes.toString('base64url'));
        await route.continue({ postData: body.toString() });
      } else await route.continue();
    });
    await passkeyName(page);
    await page.locator('#authenticateWebAuthnButton').click();
    await expect(page.locator('#kc-error-message, #kc-feedback-text, #kc-error-credential-form').first()).toBeVisible();
    await expect(page.getByTestId('lesson-user')).toHaveCount(0);
  });

  test('passkeys:disabled-user', async ({ page, context }) => {
    await virtualAuthenticator(context, page, passkeyCredentials);
    await passkeyName(page, 'passkeys-test-disabled');
    await expect(page.getByText('Account is disabled, contact your administrator.', { exact: true })).toBeVisible();
    await expect(page.locator('#authenticateWebAuthnButton')).toHaveCount(0);
  });

  test('passkeys:unconfigured-user', async ({ page, context }) => {
    await virtualAuthenticator(context, page);
    await passkeyName(page, 'passkeys-test-other');
    // Merely naming an account must never allow enrollment without its setup password.
    await expect(page.locator('#registerWebAuthn')).toHaveCount(0);
    const authenticate = page.locator('#authenticateWebAuthnButton');
    if (await authenticate.isVisible()) await authenticate.click();
    await expect(page.locator('#kc-error-message, #kc-feedback-text, #kc-error-credential-form').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('lesson-user')).toHaveCount(0);
  });

  test('passkeys:account-isolation', async ({ page, context }) => {
    page.on('dialog', dialog => dialog.accept('Second lesson passkey'));
    await virtualAuthenticator(context, page, passkeyCredentials);
    await page.goto(`${lessonOrigin}/teaching/passkeys`);
    await expect(page.getByTestId('lesson-user')).toHaveCount(0);
    await startLesson(page, 'passkeys/enroll', 'Enroll a passkey');
    await page.locator('#username').fill('passkeys-test-other');
    await page.locator('#password').fill(passwordFor('passkeys-test-other'));
    await page.locator('#kc-login').click();
    await page.locator('#registerWebAuthn').click();
    await expect(page.getByTestId('lesson-user')).toHaveText('passkeys-test-other');
  });
});

async function providerLogin(page, method, kind = 'user') {
  const title = method === 'oidc' ? 'Sign in with OpenID Connect' : 'Sign in with SAML';
  await startLesson(page, method, title);
  await expect(page).toHaveURL(/^https:\/\/shop\.magic\.test:9643\/realms\/lesson-provider\//);
  const username = `${method}-test-${kind}`;
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(passwordFor(username));
  await page.locator('#kc-login').click();
}

for (const method of ['oidc', 'saml']) {
  test(`${method}:login-audience-and-logout`, async ({ page, playwright }) => {
    const token = captureToken(page, `lesson-${method}`);
    await providerLogin(page, method);
    await expect(page.getByTestId('lesson-user')).toHaveText(`${method}-test-user`);
    await checkLessonToken(playwright, await token, method);
    await page.getByRole('button', { name: 'Sign out of lesson' }).click();
    await expect(page.getByRole('button', { name: method === 'oidc' ? 'Sign in with OpenID Connect' : 'Sign in with SAML' })).toBeVisible();
  });
  test(`${method}:disabled-provider-user`, async ({ page }) => {
    await providerLogin(page, method, 'disabled');
    await expect(page.getByText('Account is disabled, contact your administrator.', { exact: true })).toBeVisible();
    await expect(page.getByTestId('lesson-user')).toHaveCount(0);
  });
  test(`${method}:callback-state-rejection`, async ({ page }) => {
    await page.goto(`${lessonOrigin}/teaching/${method}/callback?code=invalid-fixture-code&state=unmatched-fixture-state`);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByTestId('lesson-user')).toHaveCount(0);
  });
  test(`${method}:cross-protocol-provider-rejection`, async ({ page }) => {
    const url = new URL(`https://shop.magic.test:9643/realms/lesson-${method}/protocol/openid-connect/auth`);
    url.search = new URLSearchParams({ client_id: `${method}-spa`, response_type: 'code', scope: 'openid',
      redirect_uri: `${lessonOrigin}/teaching/${method}/callback`, state: 'isolated-provider-test',
      code_challenge_method: 'S256', code_challenge: 'a'.repeat(43), kc_idp_hint: method === 'oidc' ? 'lesson-saml' : 'lesson-oidc' }).toString();
    await page.goto(url.toString());
    await expect(page.locator('#kc-error-message')).toBeVisible();
    expect(new URL(page.url()).origin).toBe('https://shop.magic.test:9643');
  });
  test(`${method}:broker-state-rejection`, async ({ page }) => {
    await page.goto(`https://shop.magic.test:9643/realms/lesson-${method}/broker/lesson-${method}/endpoint?state=unmatched-fixture-state&code=invalid-fixture-code`);
    await expect(page.locator('#kc-error-message')).toBeVisible();
    await expect(page.getByTestId('lesson-user')).toHaveCount(0);
  });
}

test('saml:modified-signed-response', async ({ page }) => {
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

test('saml:response-replay', async ({ page }) => {
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
