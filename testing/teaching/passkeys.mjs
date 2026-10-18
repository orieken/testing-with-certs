import { withAuthRecording } from './auth-recording.mjs';
import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { startLesson, captureToken, checkLessonToken, virtualAuthenticator, lessonOrigin } from './auth-lessons.mjs';
import { passkeyCaseNames, passkeySessionCaseNames } from './auth-matrix.mjs';

// Virtual credentials and browser state belong to one check and never enter reports.
async function runcheckPasskey(browser, name, playwright) {
  if (![...passkeyCaseNames, ...passkeySessionCaseNames].includes(name)) throw new Error('Unknown passkey check');
  if (passkeySessionCaseNames.includes(name) !== (process.env.LAB_AUTH_SUITE === 'passkeys-lifecycle')) throw new Error('Wrong passkey fixture phase');
  const tokenEndpoint = 'https://auth.magic.test:9443/realms/magic-shop/protocol/openid-connect/token';
  let browserRefreshes = 0;
  let assertions = 0;
  const users = JSON.parse(readFileSync('/test-secrets/auth-users.json', 'utf8'));
  let context;
  let page;
  async function fresh(credentials = []) {
    await context?.close();
    context = await browser.newContext(); page = await context.newPage();
    page.on('request', request => {
      const body = new URLSearchParams(request.postData() ?? '');
      if (request.url() === tokenEndpoint && body.get('grant_type') === 'refresh_token') browserRefreshes++;
      if (request.url().includes('/login-actions/authenticate?') && body.has('signature')) assertions++;
    });
    page.on('dialog', dialog => dialog.accept('Lesson test passkey'));
    return virtualAuthenticator(context, page, credentials);
  }
  async function enroll(username, verifyToken = false) {
    const authenticator = await fresh();
    const moduleDelayed = verifyToken ? await delayPublicModule('webauthnRegister') : undefined;
    const token = verifyToken ? captureToken(page) : undefined;
    if (token) void token.catch(() => {});
    await startLesson(page, 'passkeys/enroll', 'Enroll a passkey');
    await page.locator('#username').fill(username);
    const account = users.find(value => value.username === username);
    if (!account) throw new Error('Missing passkey fixture account');
    await page.locator('#password').fill(account.password);
    await page.locator('#kc-login').click();
    await clickWebAuthn('#registerWebAuthn');
    await expect(page.getByTestId('lesson-user')).toHaveText(username);
    if (verifyToken) {
      expect(moduleDelayed()).toBe(true);
      await checkLessonToken(playwright, await token, 'passkeys-enroll');
    }
    const credentials = await authenticator.credentials();
    expect(credentials.length).toBe(1);
    expect(credentials[0].rpId).toBe('auth.magic.test');
    return credentials;
  }
  async function identify(username) {
    await startLesson(page, 'passkeys', 'Sign in with a passkey');
    await page.locator('#username').fill(username);
    await page.locator('#kc-login').click();
  }
  async function clickWebAuthn(selector) {
    const button = page.locator(selector);
    await expect(button).toBeVisible();
    // Keycloak attaches its click handler from a deferred ES module.
    await page.waitForLoadState('load');
    await button.click();
  }
  async function delayPublicModule(name) {
    let delayed = false;
    await page.route(`**/js/${name}.js`, async route => {
      delayed = true;
      // Controlled public-script latency exercises readiness without changing WebAuthn.
      await new Promise(resolve => setTimeout(resolve, 1500));
      await route.continue();
    });
    return () => delayed;
  }
  async function rejected() {
    await expect(page.locator('#kc-error-message:visible, #kc-feedback-text:visible, #kc-error-credential-form:visible').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('lesson-user')).toHaveCount(0);
  }
  const claims = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  async function login(username) {
    const response = page.waitForResponse(value => value.url() === tokenEndpoint && value.request().method() === 'POST' && value.status() === 200);
    void response.catch(() => {});
    const previousAssertions = assertions;
    await identify(username);
    await expect(page.locator('#password')).toHaveCount(0);
    await clickWebAuthn('#authenticateWebAuthnButton');
    await expect(page.getByTestId('lesson-user')).toHaveText(username);
    expect(assertions > previousAssertions).toBe(true);
    const tokens = await (await response).json();
    expect(typeof tokens.access_token).toBe('string');
    expect(typeof tokens.refresh_token).toBe('string');
    expect(tokens.expires_in).toBe(20);
    expect(tokens.refresh_expires_in > 0 && tokens.refresh_expires_in <= 45).toBe(true);
    await checkLessonToken(playwright, tokens.access_token, 'passkeys');
    return tokens;
  }
  async function session(username) {
    const credentials = await enroll(username);
    await fresh(credentials);
    return login(username);
  }
  const refresh = (tokens, clientId = 'passkeys-spa') => context.request.post(tokenEndpoint, {
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
    await checkLessonToken(playwright, next.access_token, 'passkeys');
  }
  async function rejectedRefresh(tokens, clientId) {
    const response = await refresh(tokens, clientId);
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe('invalid_grant');
  }
  try {
    switch (name) {
      case 'passkeys:access-expiry-requires-passkey': {
        const username = 'passkeys-test-expiry';
        const tokens = await session(username);
        const remaining = claims(tokens.access_token).exp * 1000 - Date.now();
        expect(remaining > 5000).toBe(true);
        await page.waitForTimeout(Math.max(0, remaining - 3000));
        await expect(page.getByTestId('lesson-user')).toHaveText(username);
        await expect(page.getByTestId('lesson-user')).toHaveCount(0, { timeout: 10_000 });
        await expect(page.getByRole('button', { name: 'Sign in with a passkey', exact: true })).toBeVisible();
        expect(browserRefreshes).toBe(0);
        // Same browser and provider cookies: a new signed passkey assertion is mandatory.
        await login(username);
        break;
      }
      case 'passkeys:refresh-preserves-identity': {
        const username = 'passkeys-test-refresh';
        const tokens = await session(username);
        await refreshed(tokens, username);
        await expect(page.getByTestId('lesson-user')).toHaveText(username);
        expect(browserRefreshes).toBe(0);
        break;
      }
      case 'passkeys:logout-invalidates-refresh': {
        const tokens = await session('passkeys-test-logout');
        await page.getByRole('button', { name: 'Sign out of lesson' }).click();
        await expect(page.getByRole('button', { name: 'Sign in with a passkey', exact: true })).toBeVisible();
        await rejectedRefresh(tokens);
        await page.reload(); await expect(page.getByTestId('lesson-user')).toHaveCount(0);
        expect(browserRefreshes).toBe(0);
        break;
      }
      case 'passkeys:refresh-client-binding': {
        const username = 'passkeys-test-binding';
        const tokens = await session(username);
        await rejectedRefresh(tokens, 'password-otp-spa');
        // Same-token successful control rules out expiry as the mismatch rejection cause.
        await refreshed(tokens, username);
        break;
      }
      case 'passkeys:session-expiry-rejects-refresh': {
        const tokens = await session('passkeys-test-session-expiry');
        await page.waitForTimeout(tokens.refresh_expires_in * 1000 + 1500);
        await rejectedRefresh(tokens);
        await expect(page.getByTestId('lesson-user')).toHaveCount(0);
        expect(browserRefreshes).toBe(0);
        break;
      }
      case 'passkeys:enrollment': {
        await enroll('passkeys-test-enrollment', true);
        break;
      }
      case 'passkeys:login-and-logout': {
        const username = 'passkeys-test-login';
        const credentials = await enroll(username);
        await fresh(credentials);
        const token = captureToken(page);
        await identify(username);
        await expect(page.locator('#password')).toHaveCount(0);
        await clickWebAuthn('#authenticateWebAuthnButton');
        await expect(page.getByTestId('lesson-user')).toHaveText(username);
        await checkLessonToken(playwright, await token, 'passkeys');
        await page.getByRole('button', { name: 'Sign out of lesson' }).click();
        await expect(page.getByRole('button', { name: 'Sign in with a passkey' })).toBeVisible();
        await page.reload(); await expect(page.getByTestId('lesson-user')).toHaveCount(0);
        break;
      }
      case 'passkeys:missing-credential': {
        await enroll('passkeys-test-missing');
        await fresh(); await identify('passkeys-test-missing');
        await clickWebAuthn('#authenticateWebAuthnButton'); await rejected();
        break;
      }
      case 'passkeys:invalid-signature': {
        const credentials = await enroll('passkeys-test-signature');
        await fresh(credentials);
        const moduleDelayed = await delayPublicModule('webauthnAuthenticate');
        let signatureChanged = false;
        await page.route('**/login-actions/authenticate?*', async route => {
          const body = new URLSearchParams(route.request().postData() ?? '');
          if (['signature', 'clientDataJSON', 'authenticatorData', 'credentialId'].every(key => body.get(key)) && !body.get('error')) {
            const bytes = Buffer.from(body.get('signature'), 'base64url');
            if (!bytes.length) { await route.continue(); return; }
            bytes[bytes.length - 1] ^= 1;
            body.set('signature', bytes.toString('base64url')); signatureChanged = true;
            await route.continue({ postData: body.toString() });
          } else await route.continue();
        });
        await identify('passkeys-test-signature');
        await clickWebAuthn('#authenticateWebAuthnButton');
        expect(moduleDelayed()).toBe(true);
        try {
          await expect.poll(() => signatureChanged, { timeout: 30_000 }).toBe(true);
          await rejected();
        }
        catch (error) {
          console.log(`Passkey rejection state: ${JSON.stringify({ signatureChanged,
            focused: await page.evaluate(() => document.hasFocus()),
            errorMessage: await page.locator('#kc-error-message').isVisible(),
            feedback: await page.locator('#kc-feedback-text').isVisible(),
            credentialError: await page.locator('#kc-error-credential-form').isVisible(),
            identity: await page.getByTestId('lesson-user').count() > 0,
            authenticationButton: await page.locator('#authenticateWebAuthnButton').isVisible() })}`);
          throw error;
        }
        expect(signatureChanged).toBe(true);
        break;
      }
      case 'passkeys:disabled-user': {
        await fresh(); await identify('passkeys-test-disabled');
        await expect(page.getByText('Account is disabled, contact your administrator.', { exact: true })).toBeVisible();
        await expect(page.locator('#authenticateWebAuthnButton')).toHaveCount(0);
        break;
      }
      case 'passkeys:unconfigured-user': {
        await fresh(); await identify('passkeys-test-other');
        await expect(page.locator('#registerWebAuthn')).toHaveCount(0);
        if (await page.locator('#authenticateWebAuthnButton').isVisible()) await clickWebAuthn('#authenticateWebAuthnButton');
        await rejected(); break;
      }
      case 'passkeys:account-isolation': {
        const credentials = await enroll('passkeys-test-isolation');
        await fresh(credentials);
        await page.goto(`${lessonOrigin}/teaching/passkeys`);
        await expect(page.getByTestId('lesson-user')).toHaveCount(0);
        // A fresh context retains only the explicitly imported virtual credential.
        await identify('passkeys-test-second');
        await expect(page.locator('#registerWebAuthn')).toHaveCount(0);
        if (await page.locator('#authenticateWebAuthnButton').isVisible()) await clickWebAuthn('#authenticateWebAuthnButton');
        await rejected();
        await enroll('passkeys-test-second');
        break;
      }
    }
  } finally { await context?.close(); }
}

export async function checkPasskey(browser, name, playwright) {
  return withAuthRecording(browser, playwright, name, 'passkeys', (recorded, runtime) => runcheckPasskey(recorded, name, runtime));
}
