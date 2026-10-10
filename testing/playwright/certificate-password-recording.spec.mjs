import { test, expect } from '@playwright/test';
import { rename } from 'node:fs/promises';
import { checkCertificatePassword } from '../teaching/certificate-password.mjs';

test('Recorded certificate and password login verifies the issued identity', async ({ browser }) => {
  let video;
  const recordingBrowser = {
    async newContext(options) {
      const context = await browser.newContext({ ...options,
        viewport: { width: 1280, height: 720 },
        recordVideo: { dir: '/recordings', size: { width: 1280, height: 720 } },
      });
      context.on('page', page => { video = page.video(); });
      return context;
    },
  };
  // Reuse the passing identity/signature/storage/API-boundary assertions.
  await checkCertificatePassword(recordingBrowser, 'success');
  expect(video).toBeTruthy();
  await rename(await video.path(), `/recordings/certificate-password-${process.env.LAB_BROWSER}.webm`);
});
