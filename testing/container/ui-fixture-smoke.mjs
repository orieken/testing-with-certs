import { chromium, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const browserName = process.env.LAB_BROWSER;
const selected = process.env.LAB_USER;
if (!['chrome', 'msedge'].includes(browserName) || !['customer-waterdeep', 'shop-admin'].includes(selected)) throw new Error('Unsupported UI fixture case');
const cert = readFileSync('/identity/cert.pem');
const key = readFileSync('/identity/key.pem');
const shop = 'https://shop.magic.test:8443';
const auth = 'https://auth.magic.test:9443';
const browser = await chromium.launch({ channel: browserName, headless: true, timeout: 30_000 });
let context;
try {
  context = await browser.newContext({ ignoreHTTPSErrors: false, clientCertificates: [{ origin: shop, cert, key }, { origin: auth, cert, key }] });
  const page = await context.newPage();
  await page.goto(shop, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.getByRole('button', { name: 'Sign in with certificate' }).click();
  await expect(page.getByTestId('signed-in-user')).toContainText(selected, { timeout: 20_000 });
  const writes = [];
  const item = { id: 'fixture-wand', name: 'Fixture Wand', description: 'A test artifact', rarity: 'Rare', image: '/images/wand-embers.png', priceCopper: 100, active: true };
  const profile = { sub: selected, displayName: 'Fixture adventurer', regionId: 'waterdeep', location: [-120, 45] };
  const region = { type: 'Feature', properties: { regionId: 'waterdeep', name: 'Waterdeep', center: [-120, 45] }, geometry: { type: 'Polygon', coordinates: [[[-121, 44], [-119, 44], [-119, 46], [-121, 46], [-121, 44]]] } };
  let notes = [];
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname;
    const body = request.postDataJSON?.();
    if (request.method() !== 'GET') writes.push({ path, method: request.method(), body, key: request.headers()['idempotency-key'] });
    let result;
    if (path === '/api/catalog/items') result = request.method() === 'GET' ? { items: [item], nextCursor: null } : item;
    else if (path === `/api/catalog/items/${item.id}`) result = item;
    else if (path === '/api/customer/me') result = request.method() === 'PATCH' ? { ...profile, ...body } : profile;
    else if (path === '/api/customer/orders') result = request.method() === 'POST' ? { orderId: 'fixture-order', ownerSub: selected, regionId: body.regionId, status: 'completed', createdAt: '2026-10-06T00:00:00Z', completedAt: '2026-10-06T00:00:00Z', lines: [{ itemId: item.id, name: item.name, unitPriceCopper: 100, quantity: 1, lineTotalCopper: 100 }], totalCopper: 100 } : { items: [], nextCursor: null };
    else if (path === '/api/customer/me/widgets') result = request.method() === 'PUT' ? body : { widgetIds: ['recent-orders'] };
    else if (path === '/api/customer/admin/users') result = { items: [profile], nextCursor: null };
    else if (path === '/api/customer/admin/orders') result = { items: [], nextCursor: null };
    else if (path === '/api/insights/regions') result = { type: 'FeatureCollection', features: [region] };
    else if (path === '/api/insights/sales') result = { from: url.searchParams.get('from'), to: url.searchParams.get('to'), status: 'completed', orderCount: 1, customerCount: 1, salesCopper: 100, regions: [{ regionId: 'waterdeep', orderCount: 1, customerCount: 1, salesCopper: 100 }] };
    else if (path === '/api/insights/customers') result = { items: [{ sub: selected, displayName: 'Fixture adventurer', orderCount: 1, salesCopper: 100 }], nextCursor: null };
    else if (path === '/api/insights/orders') result = { items: [], nextCursor: null };
    else if (path === '/api/insights/follow-ups') { if (request.method() === 'POST') { const note = { followUpId: 'fixture-note', customerSub: body.customerSub, regionId: body.regionId, authorSub: selected, note: body.note, status: 'open', createdAt: '2026-10-06T00:00:00Z', updatedAt: '2026-10-06T00:00:00Z' }; notes = [note]; result = note; } else result = { items: notes, nextCursor: null }; }
    else if (path === '/api/insights/follow-ups/fixture-note') { notes = [{ ...notes[0], ...body }]; result = notes[0]; }
    else throw new Error(`Unexpected public API path: ${path}`);
    await route.fulfill({ status: request.method() === 'POST' ? 201 : 200, contentType: 'application/json', body: JSON.stringify(result) });
  });
  await page.getByRole('link', { name: 'Locations' }).click();
  await page.getByRole('link', { name: 'Shop', exact: true }).click();
  await expect(page.getByTestId('item-card')).toContainText('Fixture Wand');
  await page.getByTestId('item-card').getByRole('button', { name: 'Add to Cart' }).click();
  await page.getByRole('link', { name: /Cart/ }).click();
  await page.getByRole('button', { name: 'Place simulated order' }).click();
  await expect(page.getByText('Order fixture-order created.')).toBeVisible();
  const checkout = writes.find(write => write.path === '/api/customer/orders' && write.method === 'POST');
  if (!checkout || !checkout.key || JSON.stringify(checkout.body) !== JSON.stringify({ regionId: 'waterdeep', lines: [{ itemId: 'fixture-wand', quantity: 1 }] })) throw new Error('Checkout did not send only region, item IDs, quantities and an idempotency key');
  await page.getByRole('link', { name: 'Account' }).click();
  await expect(page.getByRole('heading', { name: 'Your account' })).toBeVisible();
  await expect(page.getByLabel('Display name')).toHaveValue('Fixture adventurer');
  await page.getByRole('button', { name: 'Save widgets' }).click();
  await expect(page.getByText('Widget layout saved.')).toBeVisible();
  if (selected === 'shop-admin') {
    await page.getByRole('link', { name: 'Admin' }).click();
    await expect(page.getByText('1 orders')).toBeVisible();
    await page.getByRole('combobox', { name: 'Region' }).selectOption('waterdeep');
    await page.getByRole('button', { name: 'Refresh report' }).click();
    await expect(page.getByRole('heading', { name: 'Customers who ordered in waterdeep' })).toBeVisible();
    await page.getByLabel('Customer subject').fill('fixture-customer');
    await page.getByRole('textbox', { name: 'Region' }).fill('waterdeep');
    await page.getByLabel('Note').fill('Call after visit');
    await page.getByRole('button', { name: 'Add note' }).click();
    await expect(page.getByText('Call after visit')).toBeVisible();
    await page.getByRole('button', { name: 'Mark done' }).click();
    await expect(page.getByText('fixture-customer · waterdeep · done')).toBeVisible();
  }
  console.log(`${browserName} ${selected}: fixture-backed UI interactions passed; no business provider was exercised`);
} finally { await context?.close(); await browser.close(); }
