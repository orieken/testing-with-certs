import { chromium, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const browserName = process.env.LAB_BROWSER;
const selected = process.env.LAB_USER;
if (!['chrome', 'msedge'].includes(browserName)) throw new Error('Unsupported browser');
const identities = JSON.parse(readFileSync('/work/seed/identities.json', 'utf8'));
const user = identities.find(entry => entry.username === selected) ??
  (selected === 'unknown-user' ? { username: selected, enabled: false } : undefined);
if (!user) throw new Error('Selected UI test identity is not seeded');
const certificate = { cert: readFileSync('/identity/cert.pem'), key: readFileSync('/identity/key.pem') };
const shop = 'https://shop.magic.test:8443';
const auth = 'https://auth.magic.test:9443';
const browser = await chromium.launch({ channel: browserName, headless: true, timeout: 30_000 });
let context;
try {
  context = await browser.newContext({
    ignoreHTTPSErrors: false,
    clientCertificates: [{ origin: shop, ...certificate }, { origin: auth, ...certificate }],
  });
  const page = await context.newPage();
  let catalogAuthorization = '';
  const businessRequests = [];
  page.on('request', request => {
    if (request.url().startsWith(`${shop}/api/`)) businessRequests.push(request.url());
    if (request.url().startsWith(`${shop}/api/catalog/items`)) {
      catalogAuthorization = request.headers().authorization ?? '';
    }
  });
  await page.goto(shop, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  const signIn = page.getByRole('button', { name: 'Sign in with certificate' });
  await expect(signIn).toBeVisible({ timeout: 15_000 });
  await signIn.click();
  if (user.enabled) {
    await expect(page.getByTestId('signed-in-user')).toContainText(user.username, { timeout: 20_000 });
    const expectedRole = { customer: 'Customer', shopkeeper: 'Shopkeeper', 'shop-admin': 'Shop admin' }[user.role];
    await expect(page.getByTestId('signed-in-user')).toContainText(expectedRole);
    await expect(page).toHaveURL(shop + '/');
    await expect(page.getByText('Wand of Embers')).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => catalogAuthorization, { timeout: 10_000 }).toMatch(/^Bearer /);
    const catalogClaims = JSON.parse(Buffer.from(catalogAuthorization.slice(7).split('.')[1], 'base64url').toString());
    if (catalogClaims.cert_identity !== user.certIdentity ||
        !(Array.isArray(catalogClaims.aud) ? catalogClaims.aud : [catalogClaims.aud]).includes('catalog-api')) {
      throw new Error('UI catalog request did not carry the selected user bearer token');
    }
    const stored = await page.evaluate(() => ({
      local: Object.values(localStorage),
      session: Object.values(sessionStorage),
    }));
    if ([...stored.local, ...stored.session].some(value => /access_token|refresh_token|eyJ[A-Za-z0-9_-]{40}/.test(value))) {
      throw new Error('Token-like material was persisted in browser storage');
    }
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(signIn).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('signed-in-user')).toHaveCount(0);
    console.log(`${browserName} ${selected}: Vue certificate sign-in, selected role, memory-only token and sign-out passed`);
  } else {
    await expect.poll(() => new URL(page.url()).host, { timeout: 15_000 }).toBe('auth.magic.test:9443');
    if (new URL(page.url()).searchParams.has('code')) throw new Error('Rejected identity received an authorization code');
    await expect(page.locator('input[type=password]')).toHaveCount(0);
    await expect(page.getByTestId('signed-in-user')).toHaveCount(0);
    if (businessRequests.length) throw new Error(`Rejected identity attempted business API requests: ${businessRequests.length}`);
    console.log(`${browserName} ${selected}: Vue sign-in rejected certificate with no code, password fallback, signed-in identity or business API request`);
  }
} finally {
  await context?.close();
  await browser.close();
}
