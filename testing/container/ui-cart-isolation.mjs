import { chromium, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const shop = 'https://shop.magic.test:8443';
const auth = 'https://auth.magic.test:9443';
const identities = JSON.parse(readFileSync('/work/seed/identities.json', 'utf8'));
const customerSubject = identities.find(entry => entry.username === 'customer-waterdeep')?.sub;
if (typeof customerSubject !== 'string') throw new Error('Customer seed subject missing');
const key = `dnd_cart_v3:${customerSubject}`;
const storedCart = JSON.stringify([{ id: 'fixture-item', name: 'Fixture item', priceCopperSnapshot: 100, quantity: 1 }]);
function clientCertificates(directory) {
  const cert = readFileSync(`${directory}/cert.pem`);
  const keyMaterial = readFileSync(`${directory}/key.pem`);
  return [{ origin: shop, cert, key: keyMaterial }, { origin: auth, cert, key: keyMaterial }];
}

const browser = await chromium.launch({ channel: 'chrome', headless: true, timeout: 30_000 });
let customer;
let admin;
try {
  customer = await browser.newContext({ ignoreHTTPSErrors: false, clientCertificates: clientCertificates('/customer') });
  const customerPage = await customer.newPage();
  await customerPage.goto(shop, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await customerPage.evaluate(([storageKey, value]) => localStorage.setItem(storageKey, value), [key, storedCart]);
  await customerPage.reload({ waitUntil: 'domcontentloaded' });
  await expect(customerPage.getByTestId('cart-count')).toHaveCount(0);
  await customerPage.getByRole('button', { name: 'Sign in with certificate' }).click();
  await expect(customerPage.getByTestId('signed-in-user')).toContainText('customer-waterdeep', { timeout: 20_000 });
  await expect(customerPage.getByTestId('cart-count')).toHaveText('1');
  await customerPage.getByRole('button', { name: 'Sign out' }).click();
  await expect(customerPage.getByRole('button', { name: 'Sign in with certificate' })).toBeVisible({ timeout: 20_000 });
  await expect(customerPage.getByTestId('cart-count')).toHaveCount(0);

  admin = await browser.newContext({
    ignoreHTTPSErrors: false,
    clientCertificates: clientCertificates('/admin'),
    storageState: { cookies: [], origins: [{ origin: shop, localStorage: [{ name: key, value: storedCart }] }] },
  });
  const adminPage = await admin.newPage();
  await adminPage.goto(shop, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await adminPage.getByRole('button', { name: 'Sign in with certificate' }).click();
  await expect(adminPage.getByTestId('signed-in-user')).toContainText('shop-admin', { timeout: 20_000 });
  await expect(adminPage.getByTestId('cart-count')).toHaveCount(0);
  console.log('Vue cart state remains scoped to the signed-in subject across customer logout and admin login');
} finally {
  await customer?.close();
  await admin?.close();
  await browser.close();
}
