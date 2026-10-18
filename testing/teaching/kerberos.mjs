import { withAuthRecording } from './auth-recording.mjs';
import { expect } from '@playwright/test';
import { startLesson, captureToken, checkLessonToken } from './auth-lessons.mjs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { prepareKerberosProfile } from './prepare-kerberos.mjs';
import { kerberosCaseNames } from './auth-matrix.mjs';

async function runcheckKerberos(playwright, name) {
  if (!kerberosCaseNames.includes(name)) throw new Error('Unknown Kerberos check');
  if (!['chrome', 'msedge'].includes(process.env.LAB_BROWSER)) throw new Error('Real Chrome or Edge required');
  const kind = name.slice('kerberos:'.length);
  const cache = kind === 'missing-ticket' ? '/tmp/absent-lesson-cache' :
    kind === 'expired-ticket' ? '/tickets/expired-cache' :
    kind === 'wrong-service-ticket' ? '/tickets/wrong-service-cache' : '/tickets/valid-cache';
  const profile = mkdtempSync('/tmp/kerberos-browser-');
  let context;
  try {
    prepareKerberosProfile(profile, process.env.LAB_BROWSER);
    context = await playwright.chromium.launchPersistentContext(profile, { channel: process.env.LAB_BROWSER, headless: true,
      env: { ...process.env, KRB5_CONFIG: '/etc/krb5.conf', KRB5CCNAME: `FILE:${cache}` },
      args: ['--disable-http2', '--auth-server-allowlist=auth.magic.test', '--auth-schemes=negotiate',
        '--disable-auth-negotiate-cname-lookup'] });
    const page = await context.newPage();
    let wrongServiceSubmitted = 0;
    const wrongServiceRequests = new WeakSet();
    let wrongServiceAuthorization;
    let wrongServiceRejected = false;
    if (kind === 'wrong-service-ticket') {
      const token = execFileSync('python3', ['/work/testing/teaching/wrong-service-token.py'], {
        env: { ...process.env, KRB5_CONFIG: '/etc/krb5.conf', KRB5CCNAME: 'FILE:/tickets/wrong-service-cache' },
        encoding: 'utf8', timeout: 10_000, maxBuffer: 100_000, stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(token)) throw new Error('Invalid wrong-service fixture token');
      wrongServiceAuthorization = `Negotiate ${token}`;
      await page.route('https://auth.magic.test:9443/realms/lesson-kerberos/**', async route => {
        wrongServiceSubmitted++;
        wrongServiceRequests.add(route.request());
        await route.continue({ headers: { ...route.request().headers(), authorization: wrongServiceAuthorization } });
      });
    }
    let issued = false;
    let challenged = false;
    page.on('request', request => { if (new URL(request.url()).searchParams.has('code')) issued = true; });
    page.on('response', response => {
      // A presented but unacceptable service ticket produces a broker 400, not a new 401 challenge.
      if (wrongServiceRequests.has(response.request()) && response.status() === 400) wrongServiceRejected = true;
      if (response.url().startsWith('https://auth.magic.test:9443/realms/lesson-kerberos/') && response.status() === 401) {
        challenged = true;
        if (wrongServiceRequests.has(response.request())) wrongServiceRejected = true;
      }
    });
    if (kind === 'valid-ticket') {
      const token = captureToken(page, 'lesson-kerberos');
      await startLesson(page, 'kerberos', 'Sign in with Kerberos');
      await expect(page.getByTestId('lesson-user')).toHaveText('lesson-kerberos');
      await checkLessonToken(playwright, await token, 'kerberos');
      await page.getByRole('button', { name: 'Sign out of lesson' }).click();
      await expect(page.getByRole('button', { name: 'Sign in with Kerberos' })).toBeVisible();
    } else {
      await startLesson(page, 'kerberos', 'Sign in with Kerberos').catch(() => {});
      if (kind === 'wrong-service-ticket') {
        // The tracked 400/401 is the rejection evidence; its error page need not have rendered yet.
        await expect.poll(() => wrongServiceRejected).toBe(true);
        expect(wrongServiceSubmitted).toBeGreaterThan(0);
      } else {
        await expect.poll(async () => challenged ||
          await page.locator('#kc-error-message, #kc-feedback-text').isVisible()).toBe(true);
      }
      await expect(page.getByTestId('lesson-user')).toHaveCount(0);
      await expect(page.locator('input[type=password]')).toHaveCount(0);
      expect(issued).toBe(false);
    }
  } finally {
    try { await context?.close(); } finally { rmSync(profile, { recursive: true, force: true }); }
  }
}

export async function checkKerberos(playwright, name) {
  return withAuthRecording(undefined, playwright, name, 'kerberos', (_, runtime) => runcheckKerberos(runtime, name));
}
