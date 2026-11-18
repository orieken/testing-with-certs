import { test } from '@playwright/test';
import { checkCertificatePassword } from '../teaching/certificate-password.mjs';

for (const kind of ['success', 'wrong-password', 'missing', 'wrong', 'disabled', 'unknown', 'unconfigured', 'cookies', 'shop']) {
  test(`Certificate and password: ${kind}`, async ({ browser }) => {
    await checkCertificatePassword(browser, kind, undefined, process.env.SATURDAY_REPORT_DIR ? async videos => {
      for (const [index, path] of videos.entries()) await test.info().attach(`Video ${index + 1}`, { path, contentType: 'video/webm' });
    } : undefined);
  });
}
