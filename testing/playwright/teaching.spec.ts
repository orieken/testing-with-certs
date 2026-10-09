import { expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { FileCertificateProvider } from 'saturday-keycloak-prototype';
import { createCertificateTest } from 'saturday-keycloak-prototype/playwright';
import { MagicShop } from '../site/MagicShop.js';

const selected = process.env.LAB_USER;
if (selected !== 'customer-waterdeep' && selected !== 'shopkeeper' && selected !== 'shop-admin') throw new Error('Teaching examples require customer-waterdeep, shopkeeper or shop-admin');
const provider = new FileCertificateProvider('/identity', { [`lab/${selected}`]: { cert: 'cert.pem', key: 'key.pem' } });
const test = createCertificateTest(provider, { namespace: 'lab', name: selected }, {
  origins: ['https://shop.magic.test:8443', 'https://auth.magic.test:9443'],
  issuer: 'https://auth.magic.test:9443/realms/magic-shop'
});

test('AUTH-01 AUTH-02 selected certificate opens the live shop @login', async ({ page }) => {
  const site = new MagicShop(page);
  await site.certificateLogin.execute();
  await expect(page.getByTestId('signed-in-user')).toContainText(selected);
  await expect(page.getByTestId('item-card').filter({ hasText: 'Wand of Embers' })).toBeVisible();
  await site.home.openAccount();
  await expect(page.getByRole('heading', { name: 'Your account' })).toBeVisible();
  await expect(page.getByLabel('Display name')).toHaveValue(selected === 'shop-admin' ? 'Eryn the Steward' : selected === 'shopkeeper' ? 'Dara the Shopkeeper' : 'Arin of Waterdeep');
});

test('AUTH-08 logout ends the session and the installed certificate signs in again @login', async ({ page }) => {
  const site = new MagicShop(page);
  await site.certificateLogin.execute();
  await expect(page.getByTestId('signed-in-user')).toContainText(selected);
  await site.home.signOut();
  await expect(page.getByRole('button', { name: 'Sign in with certificate' })).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await site.home.signIn();
  await expect(page.getByTestId('signed-in-user')).toContainText(selected);
});

test('SHOP-01 customer order and account @customer', async ({ page }) => {
  test.skip(selected !== 'customer-waterdeep', 'Customer example requires customer-waterdeep');
  const site = new MagicShop(page);
  await site.certificateLogin.execute();
  await expect(page.getByTestId('signed-in-user')).toContainText(selected);
  await site.home.addItem('Wand of Embers');
  await site.home.addItem('Potion of Healing');
  await site.home.openCart();
  await expect(page.getByTestId('cart-item')).toHaveCount(2);
  await site.cart.removeItem('Potion of Healing');
  await expect(page.getByTestId('cart-item')).toHaveCount(1);
  await expect(page.getByTestId('cart-item')).toContainText('Wand of Embers');
  await site.cart.placeOrder('waterdeep');
  const confirmation = page.getByRole('status').filter({ hasText: 'created. Total:' });
  await expect(confirmation).toContainText('Order order-');
  const id = (await confirmation.textContent())?.match(/order-[0-9a-f-]+/)?.[0];
  expect(id).toBeTruthy();
  await site.home.openAccount();
  await expect(page.getByText(id!, { exact: true })).toBeVisible();
});

test('WIDGET-01 ROLE-01 customer widget and admin boundary @customer', async ({ page }) => {
  test.skip(selected !== 'customer-waterdeep', 'Customer example requires customer-waterdeep');
  const site = new MagicShop(page);
  await site.certificateLogin.execute();
  await expect(page.getByTestId('signed-in-user')).toContainText(selected);
  const profileRequest = page.waitForRequest(request => new URL(request.url()).pathname === '/api/customer/me' && request.method() === 'GET');
  await site.home.openAccount();
  const authorization = (await profileRequest).headers().authorization;
  expect(authorization).toMatch(/^Bearer /);
  const widget = page.getByRole('checkbox', { name: 'Recent orders' });
  const initiallyEnabled = await widget.isChecked();
  try {
    await site.account.setRecentOrdersWidget(!initiallyEnabled);
    await expect(page.getByText('Widget layout saved.')).toBeVisible();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await site.home.signIn();
    await expect(page.getByTestId('signed-in-user')).toContainText(selected);
    await site.home.openAccount();
    await expect(widget).toBeChecked({ checked: !initiallyEnabled });
    await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
    const denied = await page.evaluate(async header => (await fetch('/api/insights/sales?from=2026-09-01T00%3A00%3A00Z&to=2026-10-01T00%3A00%3A00Z', { headers: { authorization: header } })).status, authorization!);
    expect(denied).toBe(403);
  } finally {
    if (await widget.isVisible()) await site.account.setRecentOrdersWidget(initiallyEnabled);
  }
});

test('REGION-01 MAP-01 admin Waterdeep report and local map @admin', async ({ page }) => {
  test.skip(selected !== 'shop-admin', 'Administrator example requires shop-admin');
  const externalHosts = new Set<string>();
  page.on('request', request => {
    const hostname = new URL(request.url()).hostname;
    if (hostname !== 'shop.magic.test' && hostname !== 'auth.magic.test') externalHosts.add(hostname);
  });
  const site = new MagicShop(page);
  await site.certificateLogin.execute();
  await expect(page.getByTestId('signed-in-user')).toContainText(selected);
  await site.home.openAdmin();
  await site.admin.showSeptemberWaterdeep();
  await expect(page.getByText('570.00 gp · 3 orders · 2 customers')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Customers who ordered in waterdeep' })).toBeVisible();
  await expect(page.getByLabel('Regional sales map')).toBeVisible();
  expect([...externalHosts]).toEqual([]);
});

test('MAP-01 locations map works offline and pans to allowed geolocation @admin', async ({ page }) => {
  test.skip(selected !== 'shop-admin', 'Administrator example requires shop-admin');
  const externalHosts = new Set<string>();
  page.on('request', request => {
    const hostname = new URL(request.url()).hostname;
    if (hostname !== 'shop.magic.test' && hostname !== 'auth.magic.test') externalHosts.add(hostname);
  });
  const site = new MagicShop(page);
  await site.certificateLogin.execute();
  await expect(page.getByTestId('signed-in-user')).toContainText(selected);
  await page.context().setGeolocation({ latitude: 46.25, longitude: -120.75 });
  await page.context().grantPermissions(['geolocation'], { origin: 'https://shop.magic.test:8443' });
  await page.context().setOffline(true);
  await site.home.openLocations();
  await expect(page.getByRole('heading', { name: 'Shop Locations' })).toBeVisible();
  await expect(page.locator('#map .leaflet-marker-icon')).toHaveCount(3);
  const overlays = page.locator('#map .leaflet-control-layers-overlays');
  await expect(overlays.locator('input:checked')).toHaveCount(2);
  await expect(overlays).toContainText('Shops');
  await expect(overlays).toContainText('The Sword Coast');
  expect([...externalHosts]).toEqual([]);
  await page.context().setOffline(false);
  await page.getByRole('button', { name: 'Find Nearest Shop' }).click();
  await expect.poll(async () => page.evaluate(() => {
    const map = (window as unknown as { __SATURDAY_LEAFLET_MAP__?: { getCenter(): { lat: number; lng: number } } }).__SATURDAY_LEAFLET_MAP__;
    const center = map?.getCenter();
    return center && [Math.round(center.lat * 100), Math.round(center.lng * 100)];
  })).toEqual([4625, -12075]);
  await expect(page.locator('#map .leaflet-marker-icon')).toHaveCount(3);
});

test('MAP-01 denied geolocation leaves the locations map usable @admin', async ({ page }) => {
  test.skip(selected !== 'shop-admin', 'Administrator example requires shop-admin');
  await page.context().grantPermissions([], { origin: 'https://shop.magic.test:8443' });
  const site = new MagicShop(page);
  await site.certificateLogin.execute();
  await expect(page.getByTestId('signed-in-user')).toContainText(selected);
  await site.home.openLocations();
  await expect(page.locator('#map .leaflet-marker-icon')).toHaveCount(3);
  await page.getByRole('button', { name: 'Find Nearest Shop' }).click();
  await expect(page.getByRole('status')).toContainText('Location unavailable');
  await expect(page.locator('#map .leaflet-marker-icon')).toHaveCount(3);
});

test('ROLE-03 shopkeeper manages inventory through the certificate-backed UI @shopkeeper', async ({ page }) => {
  test.skip(selected !== 'shopkeeper', 'Shopkeeper example requires shopkeeper');
  const name = `Teaching UI Item ${randomBytes(5).toString('hex')}`;
  const site = new MagicShop(page);
  await site.certificateLogin.execute();
  await expect(page.getByTestId('signed-in-user')).toContainText('shopkeeper');
  await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
  await site.home.openInventory();
  await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible();
  await site.inventory.createItem(name);
  await expect(page.getByRole('status').filter({ hasText: 'Item created.' })).toBeVisible();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await site.inventory.archiveItem(name);
  await expect(page.getByRole('status').filter({ hasText: 'Item archived.' })).toBeVisible();
  await expect(page.getByText(name, { exact: true })).toHaveCount(0);
});
