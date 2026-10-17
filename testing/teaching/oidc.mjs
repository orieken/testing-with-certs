import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { startLesson, captureToken, checkLessonToken, lessonOrigin } from './auth-lessons.mjs';
import { oidcCaseNames } from './auth-matrix.mjs';

// A scenario owns its context; credentials and tokens never enter reports.
export async function checkOidc(browser, name, playwright) {
  if (!oidcCaseNames.includes(name)) throw new Error('Unknown OIDC check');
  const context = await browser.newContext();
  const page = await context.newPage();
  async function providerLogin(kind = 'user') {
    const users = JSON.parse(readFileSync('/test-secrets/auth-users.json', 'utf8'));
    const username = `oidc-test-${kind}`;
    const account = users.find(value => value.username === username);
    if (!account) throw new Error('Missing OIDC fixture account');
    await startLesson(page, 'oidc', 'Sign in with OpenID Connect');
    await expect(page).toHaveURL(/^https:\/\/shop\.magic\.test:9643\/realms\/lesson-provider\//);
    await page.locator('#username').fill(username);
    await page.locator('#password').fill(account.password);
    await page.locator('#kc-login').click();
  }
  try {
    switch (name) {
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
