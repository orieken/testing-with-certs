import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const shop = 'https://shop.magic.test:8443';
const selected = process.env.LAB_USER;
const isAdmin = selected === 'shop-admin';

test('real certificate login with live catalog and customer data', async ({ page }) => {
  await page.goto(shop, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Sign in with certificate' }).click();
  await expect(page.getByTestId('signed-in-user')).toContainText(selected ?? 'missing-user');
  await expect(page.getByTestId('item-card').filter({ hasText: 'Wand of Embers' })).toBeVisible();
  await page.getByRole('link', { name: 'Account' }).click();
  await expect(page.getByRole('heading', { name: 'Your account' })).toBeVisible();
  await expect(page.getByLabel('Display name')).toHaveValue(isAdmin ? 'Eryn the Steward' : 'Arin of Waterdeep');
  await expect(page.getByText('Profile service is unavailable.')).toHaveCount(0);
  if (isAdmin) {
    await page.getByRole('link', { name: 'Admin' }).click();
    await expect(page.getByRole('heading', { name: 'Shop administration' })).toBeVisible();
    await expect(page.getByText('Arin of Waterdeep')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Completed sales' })).toBeVisible();
    await expect(page.getByText(/gp · \d+ orders/)).toBeVisible();
    await expect(page.getByLabel('Regional sales map')).toBeVisible();
    await expect(page.getByText('Sales service is unavailable.')).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Region' }).selectOption('waterdeep');
    await expect(page.getByRole('heading', { name: 'Customers who ordered in waterdeep' })).toBeVisible();
    await expect(page.getByText('Regional customer report is unavailable.')).toHaveCount(0);
  } else {
    await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
  }
});

test('live item detail and local branch map work without external tiles', async ({ page }) => {
  const externalRequests: string[] = [];
  page.on('request', request => {
    const host = new URL(request.url()).hostname;
    if (host !== 'shop.magic.test' && host !== 'auth.magic.test') externalRequests.push(host);
  });
  await page.goto(shop, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Sign in with certificate' }).click();
  await expect(page.getByTestId('signed-in-user')).toContainText(selected ?? 'missing-user');
  await page.getByTestId('item-name').filter({ hasText: 'Wand of Embers' }).click();
  await expect(page.getByRole('heading', { name: 'Wand of Embers' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to Cart' })).toBeVisible();
  await page.getByRole('link', { name: 'Locations' }).click();
  await expect(page.getByRole('heading', { name: 'Shop Locations' })).toBeVisible();
  await expect(page.locator('#map .leaflet-marker-icon')).toHaveCount(3);
  expect(externalRequests).toEqual([]);
});

test('customer completes a live, server-priced simulated order', async ({ page }) => {
  test.skip(isAdmin, 'The checkout recording uses the selected customer identity.');
  await page.goto(shop, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Sign in with certificate' }).click();
  await expect(page.getByTestId('signed-in-user')).toContainText(selected ?? 'missing-user');
  const wand = page.getByTestId('item-card').filter({ hasText: 'Wand of Embers' });
  await expect(wand).toBeVisible();
  await wand.getByRole('button', { name: 'Add to Cart' }).click();
  await page.getByRole('link', { name: /Cart/ }).click();
  await page.getByLabel('Order region').fill('waterdeep');
  await page.getByRole('button', { name: 'Place simulated order' }).click();
  const confirmation = page.getByRole('status').filter({ hasText: 'created. Total:' });
  await expect(confirmation).toContainText('Order order-', { timeout: 15_000 });
  const orderId = (await confirmation.textContent())?.match(/order-[0-9a-f-]+/)?.[0];
  expect(orderId).toBeTruthy();
  await page.getByRole('link', { name: 'Account' }).click();
  await expect(page.getByText(orderId!, { exact: true })).toBeVisible();
});

test('customer widget choice persists and direct admin API access is denied', async ({ page }) => {
  test.skip(isAdmin, 'The widget isolation check uses the selected customer identity.');
  await page.goto(shop, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Sign in with certificate' }).click();
  await expect(page.getByTestId('signed-in-user')).toContainText(selected ?? 'missing-user');
  const profileRequest = page.waitForRequest(req => new URL(req.url()).pathname === '/api/customer/me' && req.method() === 'GET');
  await page.getByRole('link', { name: 'Account' }).click();
  const token = (await profileRequest).headers()['authorization'];
  expect(token).toMatch(/^Bearer /);
  const widget = page.getByRole('checkbox', { name: 'Recent orders' });
  await expect(widget).toBeVisible();
  const initial = await widget.isChecked();
  if (initial) await widget.uncheck(); else await widget.check();
  await page.getByRole('button', { name: 'Save widgets' }).click();
  await expect(page.getByText('Widget layout saved.')).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  const signIn = page.getByRole('button', { name: 'Sign in with certificate' });
  await signIn.click();
  await expect(page.getByTestId('signed-in-user')).toContainText(selected ?? 'missing-user');
  await page.getByRole('link', { name: 'Account' }).click();
  await expect(page.getByRole('checkbox', { name: 'Recent orders' })).toBeChecked({ checked: !initial });
  if (initial) await page.getByRole('checkbox', { name: 'Recent orders' }).check(); else await page.getByRole('checkbox', { name: 'Recent orders' }).uncheck();
  await page.getByRole('button', { name: 'Save widgets' }).click();
  await expect(page.getByText('Widget layout saved.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
  const denied = await page.evaluate(async authorization => (await fetch('/api/insights/sales?from=2026-09-01T00%3A00%3A00Z&to=2026-10-01T00%3A00%3A00Z', { headers: { authorization } })).status, token!);
  expect(denied).toBe(403);
});

test('admin report filters and local follow-up survive reload', async ({ page }) => {
  test.skip(!isAdmin, 'The reporting and follow-up check uses the selected administrator identity.');
  await page.goto(shop, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Sign in with certificate' }).click();
  await expect(page.getByTestId('signed-in-user')).toContainText(selected ?? 'missing-user');
  await page.getByRole('link', { name: 'Admin' }).click();
  await expect(page.getByRole('heading', { name: 'Shop administration' })).toBeVisible();
  await page.getByLabel('From (UTC)').fill('2026-09-01');
  await page.getByLabel('To (exclusive, UTC)').fill('2026-10-01');
  await page.getByRole('button', { name: 'Refresh report' }).click();
  await page.getByRole('combobox', { name: 'Region' }).selectOption('waterdeep');
  await expect(page.getByText('570.00 gp · 3 orders · 2 customers')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Customers who ordered in waterdeep' })).toBeVisible();
  await expect(page.getByLabel('Regional sales map')).toBeVisible();
  const note = `UI follow-up ${randomUUID()}`;
  await page.getByRole('textbox', { name: 'Customer subject' }).fill('10101010-1010-4010-8010-101010101010');
  await page.getByRole('textbox', { name: 'Region', exact: true }).fill('waterdeep');
  await page.getByRole('textbox', { name: 'Note' }).fill(note);
  await page.getByRole('button', { name: 'Add note' }).click();
  const row = page.locator('div.border-t').filter({ hasText: note });
  await expect(row).toContainText('open');
  await row.getByRole('button', { name: 'Mark done' }).click();
  await expect(row).toContainText('done');
  await page.reload({ waitUntil: 'domcontentloaded' });
  const signIn = page.getByRole('button', { name: 'Sign in with certificate' });
  await signIn.click();
  await expect(page.getByTestId('signed-in-user')).toContainText(selected ?? 'missing-user');
  await page.getByRole('link', { name: 'Admin' }).click();
  await expect(page.locator('div.border-t').filter({ hasText: note })).toContainText('done');
});

test('fixture-backed shop interaction with selected certificate', async ({ page }) => {
  await page.goto(shop, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Sign in with certificate' }).click();
  await expect(page.getByTestId('signed-in-user')).toContainText(selected ?? 'missing-user');

  const item = { id: 'fixture-wand', name: 'Fixture Wand', description: 'A test artifact', rarity: 'Rare', image: '/images/wand-embers.png', priceCopper: 100, active: true };
  const profile = { sub: selected, displayName: 'Fixture adventurer', regionId: 'waterdeep', location: [-120, 45] };
  const region = { type: 'Feature', properties: { regionId: 'waterdeep', name: 'Waterdeep', center: [-120, 45] }, geometry: { type: 'Polygon', coordinates: [[[-121, 44], [-119, 44], [-119, 46], [-121, 46], [-121, 44]]] } };
  const writes: Array<{ path: string; body: unknown; key?: string }> = [];
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const body: unknown = request.postDataJSON();
    if (request.method() !== 'GET') writes.push({ path, body, key: request.headers()['idempotency-key'] });
    let result: unknown;
    if (path === '/api/catalog/items') result = { items: [item], nextCursor: null };
    else if (path === '/api/customer/me') result = profile;
    else if (path === '/api/customer/orders') result = request.method() === 'POST'
      ? { orderId: 'fixture-order', ownerSub: selected, regionId: 'waterdeep', status: 'completed', createdAt: '2026-10-06T00:00:00Z', completedAt: '2026-10-06T00:00:00Z', lines: [{ itemId: item.id, name: item.name, unitPriceCopper: 100, quantity: 1, lineTotalCopper: 100 }], totalCopper: 100 }
      : { items: [], nextCursor: null };
    else if (path === '/api/customer/me/widgets') result = request.method() === 'PUT' ? body : { widgetIds: ['recent-orders'] };
    else if (path === '/api/insights/regions') result = { type: 'FeatureCollection', features: [region] };
    else if (path === '/api/insights/sales') result = { from: url.searchParams.get('from'), to: url.searchParams.get('to'), status: 'completed', orderCount: 1, customerCount: 1, salesCopper: 100, regions: [{ regionId: 'waterdeep', orderCount: 1, customerCount: 1, salesCopper: 100 }] };
    else if (path === '/api/customer/admin/users') result = { items: [profile], nextCursor: null };
    else if (path === '/api/customer/admin/orders' || path === '/api/insights/follow-ups') result = { items: [], nextCursor: null };
    else throw new Error(`Unexpected fixture API path: ${path}`);
    await route.fulfill({ status: request.method() === 'POST' ? 201 : 200, contentType: 'application/json', body: JSON.stringify(result) });
  });

  await page.getByRole('link', { name: 'Locations' }).click();
  await page.getByRole('link', { name: 'Shop', exact: true }).click();
  await expect(page.getByTestId('item-card')).toContainText('Fixture Wand');
  await page.getByTestId('item-card').getByRole('button', { name: 'Add to Cart' }).click();
  await page.getByRole('link', { name: /Cart/ }).click();
  await page.getByRole('button', { name: 'Place simulated order' }).click();
  await expect(page.getByText('Order fixture-order created.')).toBeVisible();
  expect(writes.find(write => write.path === '/api/customer/orders')).toMatchObject({
    body: { regionId: 'waterdeep', lines: [{ itemId: 'fixture-wand', quantity: 1 }] },
    key: expect.any(String)
  });
  if (isAdmin) {
    await page.getByRole('link', { name: 'Admin' }).click();
    await expect(page.getByText('1 orders')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Regions' })).toBeVisible();
  }
});
