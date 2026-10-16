import { test, expect } from '@playwright/test';
import { startLesson, captureToken, checkLessonToken } from '../teaching/auth-lessons.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { prepareKerberosProfile } from '../teaching/prepare-kerberos.mjs';

const disabled = process.env.LAB_KERBEROS_DISABLED === '1';
for (const kind of disabled ? ['disabled-user'] : ['valid-ticket', 'missing-ticket', 'expired-ticket']) {
  test(`kerberos:${kind}`, async ({ playwright }) => {
    const cache = kind === 'missing-ticket' ? '/tmp/absent-lesson-cache' :
      kind === 'expired-ticket' ? '/tickets/expired-cache' : '/tickets/valid-cache';
    const profile = mkdtempSync('/tmp/kerberos-browser-');
    prepareKerberosProfile(profile, process.env.LAB_BROWSER);
    const context = await playwright.chromium.launchPersistentContext(profile, { channel: process.env.LAB_BROWSER, headless: true,
      env: { ...process.env, KRB5_CONFIG: '/etc/krb5.conf', KRB5CCNAME: `FILE:${cache}` },
      args: ['--disable-http2', '--auth-server-allowlist=auth.magic.test', '--auth-schemes=negotiate',
        '--disable-auth-negotiate-cname-lookup'] });
    try {
      const page = await context.newPage();
      let issued = false;
      let challenged = false;
      page.on('request', request => { if (new URL(request.url()).searchParams.has('code')) issued = true; });
      page.on('response', response => {
        if (response.url().startsWith('https://auth.magic.test:9443/realms/lesson-kerberos/') && response.status() === 401) challenged = true;
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
        await expect(page.getByTestId('lesson-user')).toHaveCount(0);
        await expect(page.locator('input[type=password]')).toHaveCount(0);
        expect(challenged || await page.locator('#kc-error-message, #kc-feedback-text').isVisible()).toBe(true);
        expect(issued).toBe(false);
      }
    } finally { await context.close(); rmSync(profile, { recursive: true, force: true }); }
  });
}
