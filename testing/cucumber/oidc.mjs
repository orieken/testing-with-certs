import { BeforeAll, AfterAll, Given, setDefaultTimeout } from '@cucumber/cucumber';
import * as playwright from '@playwright/test';
import { checkOidc } from '../teaching/oidc.mjs';
let browser;
setDefaultTimeout(120_000);
BeforeAll(async () => {
  const channel = process.env.LAB_BROWSER;
  if (!['chrome', 'msedge'].includes(channel)) throw new Error('Real Chrome or Edge required');
  browser = await playwright.chromium.launch({ channel, headless: true, args: ['--disable-http2'], timeout: 30_000 });
});
AfterAll(async () => { await browser?.close(); });
Given('the OIDC check {string} passes', async function (name) {
  await checkOidc(browser, name, playwright);
});
