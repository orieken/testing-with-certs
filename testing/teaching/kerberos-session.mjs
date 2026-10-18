import { expect } from '@playwright/test';
import { mkdtempSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { prepareKerberosProfile } from './prepare-kerberos.mjs';
import { startLesson, checkLessonToken } from './auth-lessons.mjs';
import { kerberosSessionCaseNames } from './auth-matrix.mjs';

export async function checkKerberosSession(playwright, name) {
  if (!kerberosSessionCaseNames.includes(name) || process.env.LAB_AUTH_SUITE !== 'kerberos-lifecycle') throw new Error('Wrong Kerberos lifecycle selection');
  if (!['chrome', 'msedge'].includes(process.env.LAB_BROWSER)) throw new Error('Real Chrome or Edge required');
  const directory = mkdtempSync('/tmp/kerberos-lifecycle-');
  const cache = `${directory}/ticket-cache`;
  const profile = `${directory}/profile`;
  const endpoint = 'https://auth.magic.test:9443/realms/lesson-kerberos/protocol/openid-connect/token';
  const claims = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  let context;
  try {
    copyFileSync('/tickets/valid-cache', cache);
    prepareKerberosProfile(profile, process.env.LAB_BROWSER);
    context = await playwright.chromium.launchPersistentContext(profile, {
      channel: process.env.LAB_BROWSER, headless: true,
      env: { ...process.env, KRB5_CONFIG: '/etc/krb5.conf', KRB5CCNAME: `FILE:${cache}` },
      args: ['--disable-http2', '--auth-server-allowlist=auth.magic.test', '--auth-schemes=negotiate', '--disable-auth-negotiate-cname-lookup'],
    });
    const page = await context.newPage();
    let browserRefreshes = 0;
    let authorizations = 0;
    page.on('request', request => {
      if (request.url().startsWith('https://auth.magic.test:9443/realms/lesson-kerberos/protocol/openid-connect/auth?')) authorizations++;
      if (request.url() === endpoint && new URLSearchParams(request.postData() ?? '').get('grant_type') === 'refresh_token') browserRefreshes++;
    });
    async function session() {
      const pending = page.waitForResponse(response => response.url() === endpoint && response.request().method() === 'POST' && response.status() === 200);
      void pending.catch(() => {});
      const before = authorizations;
      await startLesson(page, 'kerberos', 'Sign in with Kerberos');
      await expect(page.getByTestId('lesson-user')).toHaveText('lesson-kerberos');
      expect(authorizations > before).toBe(true);
      const tokens = await (await pending).json();
      expect(typeof tokens.access_token).toBe('string');
      expect(typeof tokens.refresh_token).toBe('string');
      expect(tokens.expires_in).toBe(20);
      expect(tokens.refresh_expires_in > 0 && tokens.refresh_expires_in <= 45).toBe(true);
      expect(claims(tokens.access_token).preferred_username).toBe('lesson-kerberos');
      await checkLessonToken(playwright, tokens.access_token, 'kerberos');
      return tokens;
    }
    const refresh = (tokens, clientId = 'kerberos-spa') => context.request.post(endpoint, {
      form: { grant_type: 'refresh_token', client_id: clientId, refresh_token: tokens.refresh_token },
    });
    async function rejected(tokens, clientId) {
      const response = await refresh(tokens, clientId);
      expect(response.status()).toBe(400);
      expect((await response.json()).error).toBe('invalid_grant');
    }
    async function refreshed(tokens) {
      const before = authorizations;
      const response = await refresh(tokens);
      expect(response.status()).toBe(200);
      const next = await response.json();
      expect(typeof next.access_token).toBe('string');
      expect(next.access_token !== tokens.access_token).toBe(true);
      expect(claims(next.access_token).sub === claims(tokens.access_token).sub).toBe(true);
      expect(claims(next.access_token).preferred_username).toBe('lesson-kerberos');
      await checkLessonToken(playwright, next.access_token, 'kerberos');
      expect(authorizations).toBe(before);
    }
    const tokens = await session();
    switch (name) {
      case 'kerberos:access-expiry-reenters-login': {
        const remaining = claims(tokens.access_token).exp * 1000 - Date.now();
        expect(remaining > 5000).toBe(true);
        await page.waitForTimeout(Math.max(0, remaining - 3000));
        await expect(page.getByTestId('lesson-user')).toHaveText('lesson-kerberos');
        await expect(page.getByTestId('lesson-user')).toHaveCount(0, { timeout: 10_000 });
        await expect(page.getByRole('button', { name: 'Sign in with Kerberos' })).toBeVisible();
        const next = await session();
        expect(claims(next.access_token).sub === claims(tokens.access_token).sub).toBe(true);
        break;
      }
      case 'kerberos:refresh-without-ticket-cache':
        // Remove only this scenario's private cache, never the shared provisioned fixtures.
        rmSync(cache);
        expect(existsSync(cache)).toBe(false);
        await refreshed(tokens);
        await expect(page.getByTestId('lesson-user')).toHaveText('lesson-kerberos');
        expect(existsSync(cache)).toBe(false);
        break;
      case 'kerberos:logout-invalidates-refresh':
        await page.getByRole('button', { name: 'Sign out of lesson' }).click();
        await expect(page.getByRole('button', { name: 'Sign in with Kerberos' })).toBeVisible();
        await rejected(tokens);
        await page.reload();
        await expect(page.getByTestId('lesson-user')).toHaveCount(0);
        break;
      case 'kerberos:refresh-client-binding':
        await rejected(tokens, 'account-console');
        await refreshed(tokens);
        break;
      case 'kerberos:session-expiry-rejects-refresh':
        await page.waitForTimeout(tokens.refresh_expires_in * 1000 + 1500);
        await rejected(tokens);
        await expect(page.getByTestId('lesson-user')).toHaveCount(0);
        break;
    }
    expect(browserRefreshes).toBe(0);
    await expect(page.locator('input[type=password]')).toHaveCount(0);
  } finally {
    try { await context?.close(); } finally { rmSync(directory, { recursive: true, force: true }); }
  }
}
