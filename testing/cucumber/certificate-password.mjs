import { BeforeAll, AfterAll, Given, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium } from '@playwright/test';
import { checkCertificatePassword } from '../teaching/certificate-password.mjs';
let browser;
setDefaultTimeout(90_000);
BeforeAll(async () => {
  const channel = process.env.LAB_BROWSER;
  if (!['chrome', 'msedge'].includes(channel)) throw new Error('Real Chrome or Edge required');
  browser = await chromium.launch({ channel, headless: true, args: ['--disable-http2'], timeout: 30_000 });
});
AfterAll(async () => { await browser?.close(); });
Given('the certificate and password check {string} passes', async function (kind) {
  await checkCertificatePassword(browser, kind);
});
