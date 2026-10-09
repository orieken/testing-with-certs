import { chromium, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const browserName = process.env.LAB_BROWSER;
const selected = process.env.LAB_USER;
if (!['chrome', 'msedge'].includes(browserName)) throw new Error('Select real Chrome or Edge');
if (!['customer-waterdeep', 'shop-admin'].includes(selected)) throw new Error('Select a smoke-test identity');
const cert = readFileSync('/identity/cert.pem');
const key = readFileSync('/identity/key.pem');
const shop = 'https://shop.magic.test:8443';
const auth = 'https://auth.magic.test:9443';
const browser = await chromium.launch({ channel: browserName, headless: true, timeout: 30_000 });
let context;
try {
  context = await browser.newContext({ ignoreHTTPSErrors: false, clientCertificates: [{ origin: shop, cert, key }, { origin: auth, cert, key }] });
  const page = await context.newPage();
  const requests = [];
  page.on('request', request => { if (request.url().startsWith(`${shop}/api/`)) requests.push({ url: request.url(), authorization: request.headers().authorization }); });
  await page.goto(shop, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.getByRole('button', { name: 'Sign in with certificate' }).click();
  await expect(page.getByTestId('signed-in-user')).toContainText(selected, { timeout: 20_000 });
  await expect(page.getByRole('alert')).toContainText('Catalog is unavailable', { timeout: 12_000 });
  await page.getByRole('link', { name: 'Account' }).click();
  await expect(page.getByRole('heading', { name: 'Your account' })).toBeVisible();
  await expect(page.getByText('Profile service is unavailable.')).toBeVisible({ timeout: 12_000 });
  await page.getByRole('link', { name: 'Cart' }).click();
  await expect(page.getByTestId('cart-empty')).toBeVisible();
  if (selected === 'shop-admin') {
    await page.getByRole('link', { name: 'Inventory' }).click();
    await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible();
    await expect(page.getByText('Catalog service is unavailable.')).toBeVisible({ timeout: 12_000 });
    await page.getByRole('link', { name: 'Admin' }).click();
    await expect(page.getByRole('heading', { name: 'Shop administration' })).toBeVisible();
    await expect(page.getByText('Sales service is unavailable.').first()).toBeVisible({ timeout: 12_000 });
  } else {
    await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
    await page.goto(`${shop}/admin`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Shop administrator access is required.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Inventory' })).toHaveCount(0);
  }
  const expected = ['/api/catalog/items', '/api/customer/me', '/api/customer/orders', '/api/customer/me/widgets'];
  for (const path of expected) {
    if (!requests.some(request => request.url.includes(path) && request.authorization?.startsWith('Bearer '))) throw new Error(`Missing authenticated request: ${path}`);
  }
  console.log(`${browserName} ${selected}: full UI routes, role navigation, honest 503 states and bearer requests passed`);
} finally { await context?.close(); await browser.close(); }
