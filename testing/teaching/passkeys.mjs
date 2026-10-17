import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { startLesson, captureToken, checkLessonToken, virtualAuthenticator, lessonOrigin } from './auth-lessons.mjs';
import { passkeyCaseNames } from './auth-matrix.mjs';

// Virtual credentials and browser state belong to one check and never enter reports.
export async function checkPasskey(browser, name, playwright) {
  if (!passkeyCaseNames.includes(name)) throw new Error('Unknown passkey check');
  const users = JSON.parse(readFileSync('/test-secrets/auth-users.json', 'utf8'));
  let context;
  let page;
  async function fresh(credentials = []) {
    await context?.close();
    context = await browser.newContext(); page = await context.newPage();
    page.on('dialog', dialog => dialog.accept('Lesson test passkey'));
    return virtualAuthenticator(context, page, credentials);
  }
  async function enroll(username, verifyToken = false) {
    const authenticator = await fresh();
    const token = verifyToken ? captureToken(page) : undefined;
    await startLesson(page, 'passkeys/enroll', 'Enroll a passkey');
    await page.locator('#username').fill(username);
    const account = users.find(value => value.username === username);
    if (!account) throw new Error('Missing passkey fixture account');
    await page.locator('#password').fill(account.password);
    await page.locator('#kc-login').click();
    await page.locator('#registerWebAuthn').click();
    await expect(page.getByTestId('lesson-user')).toHaveText(username);
    if (verifyToken) await checkLessonToken(playwright, await token, 'passkeys-enroll');
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
  async function rejected() {
    await expect(page.locator('#kc-error-message:visible, #kc-feedback-text:visible, #kc-error-credential-form:visible').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('lesson-user')).toHaveCount(0);
  }
  try {
    switch (name) {
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
        await page.locator('#authenticateWebAuthnButton').click();
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
        await page.locator('#authenticateWebAuthnButton').click(); await rejected();
        break;
      }
      case 'passkeys:invalid-signature': {
        const credentials = await enroll('passkeys-test-signature');
        await fresh(credentials);
        let signatureChanged = false;
        await page.route('**/login-actions/authenticate?*', async route => {
          const body = new URLSearchParams(route.request().postData() ?? '');
          if (body.has('signature')) {
            const bytes = Buffer.from(body.get('signature'), 'base64url');
            bytes[bytes.length - 1] ^= 1;
            body.set('signature', bytes.toString('base64url')); signatureChanged = true;
            await route.continue({ postData: body.toString() });
          } else await route.continue();
        });
        await identify('passkeys-test-signature');
        await page.locator('#authenticateWebAuthnButton').click();
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
        if (await page.locator('#authenticateWebAuthnButton').isVisible()) await page.locator('#authenticateWebAuthnButton').click();
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
        if (await page.locator('#authenticateWebAuthnButton').isVisible()) await page.locator('#authenticateWebAuthnButton').click();
        await rejected();
        await enroll('passkeys-test-second');
        break;
      }
    }
  } finally { await context?.close(); }
}
