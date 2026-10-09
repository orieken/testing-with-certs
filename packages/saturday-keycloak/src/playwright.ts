import { test as base, type Browser, type BrowserContext } from '@playwright/test';
import { createClientCertConfig } from '@orieken/saturday-playwright-certs';
import { validateTarget, type AuthenticationTarget, type CertificateProvider, type IdentityRef } from './core.js';

export type CertificateContextOptions = { ignoreHTTPSErrors: false; clientCertificates: Array<{ origin: string; certPath: string; keyPath: string }> };
export async function certificateContextOptions(provider: CertificateProvider, ref: IdentityRef, target: AuthenticationTarget): Promise<CertificateContextOptions> {
  validateTarget(target);
  const material = await provider.resolve(ref);
  return {
    ignoreHTTPSErrors: false,
    clientCertificates: target.origins.map(origin => ({ origin, certPath: material.cert, keyPath: material.key }))
  };
}

/** Reuse Saturday's conventional path helper when a consumer uses its layout. */
export function saturdayConvention(origin: string, root: string, name: string): { origin: string; certPath: string; keyPath: string } {
  return createClientCertConfig(origin, root, name);
}

export function createCertificateTest(provider: CertificateProvider, ref: IdentityRef, target: AuthenticationTarget): typeof base {
  return base.extend({
    context: async ({ browser }, use, testInfo) => {
      const options = await certificateContextOptions(provider, ref, target);
      const recordVideo = testInfo.project.use.video === 'on';
      const context = await browser.newContext({ ...options, ...(recordVideo ? { recordVideo: { dir: testInfo.outputPath('videos') } } : {}) });
      try { await use(context); }
      finally {
        const pages = context.pages();
        await context.close();
        if (recordVideo) for (const page of pages) {
          const path = await page.video()?.path();
          if (path) await testInfo.attach('video', { path, contentType: 'video/webm' });
        }
      }
    }
  });
}

export async function createCertificateContext(browser: Browser, provider: CertificateProvider, ref: IdentityRef, target: AuthenticationTarget): Promise<BrowserContext> {
  return browser.newContext(await certificateContextOptions(provider, ref, target));
}

export async function certificateApiOptions(provider: CertificateProvider, ref: IdentityRef, target: AuthenticationTarget): Promise<CertificateContextOptions> {
  return certificateContextOptions(provider, ref, target);
}
