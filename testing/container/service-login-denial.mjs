import { chromium } from '@playwright/test';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const channel = process.env.LAB_BROWSER;
if (!['chrome', 'msedge'].includes(channel)) throw new Error('Unsupported browser');
const browser = await chromium.launch({ channel, headless: true, timeout: 30_000 });
let context;
try {
  const cert = { cert: readFileSync('/service-identity/cert.pem'), key: readFileSync('/service-identity/key.pem') };
  context = await browser.newContext({
    ignoreHTTPSErrors: false,
    clientCertificates: [{ origin: 'https://auth.magic.test:9443', ...cert }],
  });
  const verifier = randomBytes(32).toString('base64url');
  const url = new URL('https://auth.magic.test:9443/realms/magic-shop/protocol/openid-connect/auth');
  for (const [key, value] of Object.entries({
    response_type: 'code', client_id: 'shop-spa',
    redirect_uri: 'https://shop.magic.test:8443/callback',
    scope: 'openid', code_challenge_method: 'S256',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    state: randomBytes(16).toString('base64url'),
  })) url.searchParams.set(key, value);
  const page = await context.newPage();
  let tlsDenied = false;
  try { await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 15_000 }); }
  catch { tlsDenied = true; console.log(`${channel}: service certificate rejected by Keycloak TLS`); }
  if (!tlsDenied) {
    if (new URL(page.url()).searchParams.has('code')) throw new Error('Service certificate became a human login');
    if (await page.locator('input[type=password]').count()) throw new Error('Password fallback appeared');
    console.log(`${channel}: service certificate received no human authorization code`);
  }
} finally {
  await context?.close();
  await browser.close();
}
