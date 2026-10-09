import { After, Before, Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { MagicShop } from '../dist/site/MagicShop.js';

const selected = process.env.LAB_USER;
const channel = process.env.LAB_BROWSER;
if (selected !== 'customer-waterdeep' && selected !== 'shop-admin') throw new Error('Teaching examples require customer-waterdeep or shop-admin');
if (channel !== 'chrome' && channel !== 'msedge') throw new Error('Real browser required');

Before(function (scenario) {
  this.startedAt = process.hrtime.bigint();
  this.scenarioTitle = scenario.pickle.name;
  this.externalHosts = new Set();
});
After(async function (scenario) {
  if (this.restoreWidget !== undefined && this.site && await this.page.getByRole('checkbox', { name: 'Recent orders' }).isVisible().catch(() => false)) {
    await this.site.account.setRecentOrdersWidget(this.restoreWidget);
  }
  const path = process.env.LAB_SCENARIO_TELEMETRY;
  if (path) {
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, `${JSON.stringify({ scenario: this.scenarioTitle, status: scenario.result?.status, durationMs: Number(process.hrtime.bigint() - this.startedAt) / 1e6, browser: channel, selectedUser: selected })}\n`, { mode: 0o644 });
  }
});

Given('I sign in to the live shop with my selected certificate', async function () {
  this.site = new MagicShop(this.page);
  this.page.on('request', request => {
    const host = new URL(request.url()).hostname;
    if (host !== 'shop.magic.test' && host !== 'auth.magic.test') this.externalHosts.add(host);
  });
  await this.site.certificateLogin.execute();
  await expect(this.page.getByTestId('signed-in-user')).toContainText(selected);
});
Then('my selected identity and live catalog are visible', async function () {
  await expect(this.page.getByTestId('signed-in-user')).toContainText(selected);
  await expect(this.page.getByTestId('item-card').filter({ hasText: 'Wand of Embers' })).toBeVisible();
});
When('I open my account', async function () { await this.site.home.openAccount(); });
Then('my seeded display name is visible', async function () {
  await expect(this.page.getByRole('heading', { name: 'Your account' })).toBeVisible();
  await expect(this.page.getByLabel('Display name')).toHaveValue(selected === 'shop-admin' ? 'Eryn the Steward' : 'Arin of Waterdeep');
});
When('I add the Wand of Embers and place an order in waterdeep', async function () {
  await this.site.home.addItem('Wand of Embers');
  await this.site.home.addItem('Potion of Healing');
  await this.site.home.openCart();
  await expect(this.page.getByTestId('cart-item')).toHaveCount(2);
  await this.site.cart.removeItem('Potion of Healing');
  await expect(this.page.getByTestId('cart-item')).toHaveCount(1);
  await expect(this.page.getByTestId('cart-item')).toContainText('Wand of Embers');
  await this.site.cart.placeOrder('waterdeep');
  const confirmation = this.page.getByRole('status').filter({ hasText: 'created. Total:' });
  await expect(confirmation).toContainText('Order order-');
  this.orderId = (await confirmation.textContent())?.match(/order-[0-9a-f-]+/)?.[0];
  expect(this.orderId).toBeTruthy();
});
When('I sign out and revisit the shop', async function () {
  await this.site.home.signOut();
  await expect(this.page.getByRole('button', { name: 'Sign in with certificate' })).toBeVisible();
  await this.page.reload({ waitUntil: 'domcontentloaded' });
});
Then('my selected certificate signs in again without a password', async function () {
  await this.site.home.signIn();
  await expect(this.page.getByTestId('signed-in-user')).toContainText(selected);
  await expect(this.page.locator('input[type="password"]')).toHaveCount(0);
});
Then('the created order appears in my account', async function () {
  await this.site.home.openAccount();
  await expect(this.page.getByText(this.orderId, { exact: true })).toBeVisible();
});
When('I change and save my recent-orders widget', async function () {
  const profile = this.page.waitForRequest(request => new URL(request.url()).pathname === '/api/customer/me' && request.method() === 'GET');
  await this.site.home.openAccount();
  this.authorization = (await profile).headers().authorization;
  expect(this.authorization).toMatch(/^Bearer /);
  this.restoreWidget = await this.page.getByRole('checkbox', { name: 'Recent orders' }).isChecked();
  await this.site.account.setRecentOrdersWidget(!this.restoreWidget);
  await expect(this.page.getByText('Widget layout saved.')).toBeVisible();
});
Then('the widget setting persists after a fresh certificate sign-in', async function () {
  await this.page.reload({ waitUntil: 'domcontentloaded' });
  await this.site.home.signIn();
  await expect(this.page.getByTestId('signed-in-user')).toContainText(selected);
  await this.site.home.openAccount();
  await expect(this.page.getByRole('checkbox', { name: 'Recent orders' })).toBeChecked({ checked: !this.restoreWidget });
});
Then('the admin report rejects my customer token', async function () {
  await expect(this.page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
  const status = await this.page.evaluate(async authorization => (await fetch('/api/insights/sales?from=2026-09-01T00%3A00%3A00Z&to=2026-10-01T00%3A00%3A00Z', { headers: { authorization } })).status, this.authorization);
  expect(status).toBe(403);
});
When('I select the September Waterdeep report', async function () {
  await this.site.home.openAdmin();
  await this.site.admin.showSeptemberWaterdeep();
});
Then('the report shows 570 gp across three orders and two customers', async function () {
  await expect(this.page.getByText('570.00 gp · 3 orders · 2 customers')).toBeVisible();
  await expect(this.page.getByRole('heading', { name: 'Customers who ordered in waterdeep' })).toBeVisible();
});
Then('the regional map needs no external host', async function () {
  await expect(this.page.getByLabel('Regional sales map')).toBeVisible();
  expect([...this.externalHosts]).toEqual([]);
});
