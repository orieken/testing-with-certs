import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const browserName = process.env.LAB_BROWSER;
if (!['chrome', 'msedge'].includes(browserName)) throw new Error('LAB_BROWSER must be chrome or msedge');
const browser = await chromium.launch({ channel: browserName, headless: true, timeout: 30_000 });
try {
  const certificate = { cert: readFileSync('/identity/cert.pem'), key: readFileSync('/identity/key.pem') };
  const context = await browser.newContext({
    ignoreHTTPSErrors: false,
    clientCertificates: [
      { origin: 'https://shop.magic.test:8443', ...certificate },
      { origin: 'https://auth.magic.test:9443', ...certificate },
    ],
  });
  const page = await context.newPage();
  const navigation = await page.goto('https://shop.magic.test:8443/', { waitUntil: 'domcontentloaded', timeout: 15_000 });
  if (navigation?.status() !== 200) throw new Error(`Browser shop navigation returned ${navigation?.status()}`);
  const shop = await context.request.get('https://shop.magic.test:8443/', { timeout: 15_000 });
  if (shop.status() !== 200) throw new Error(`Shop returned ${shop.status()}`);
  const auth = await context.request.get('https://auth.magic.test:9443/realms/master/.well-known/openid-configuration', { timeout: 15_000 });
  if (auth.status() !== 200) throw new Error(`Auth returned ${auth.status()}`);
  const api = await context.request.get('https://shop.magic.test:8443/api/catalog/items', { timeout: 15_000 });
  if (api.status() !== 503) throw new Error(`Placeholder API returned ${api.status()}`);
  const hidden = await context.request.get('https://shop.magic.test:8443/internal/catalog/quote', { timeout: 15_000 });
  if (hidden.status() !== 404) throw new Error(`Private route returned ${hidden.status()}`);
  const noCert = await browser.newContext({ ignoreHTTPSErrors: false });
  let noCertFailed = false;
  try { await noCert.request.get('https://shop.magic.test:8443/', { timeout: 10_000 }); }
  catch { noCertFailed = true; }
  await noCert.close();
  if (!noCertFailed) throw new Error('Shop accepted a missing user certificate');
  let wrongHostnameFailed = false;
  try { await context.request.get('https://gateway:8443/', { timeout: 10_000 }); }
  catch { wrongHostnameFailed = true; }
  if (!wrongHostnameFailed) throw new Error('Shop accepted the wrong server hostname');
  console.log(`${browserName}: exact origins 200, placeholder 503, private route 404, no-cert and wrong-hostname rejected`);
  await context.close();
} finally { await browser.close(); }
