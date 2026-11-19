import { test, expect } from '../../packages/saturday-playwright-reporter/node_modules/@playwright/test/index.mjs';
import { pathToFileURL } from 'node:url';
import { writeUiFixture } from './ui-fixture.mjs';

test.beforeEach(async ({ page }, info) => {
  const errors = [], network = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
  page.__reportErrors = errors; page.__reportNetwork = network;
  await page.goto(pathToFileURL(writeUiFixture(info.outputPath('report'))).href);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Saturday UI regression report');
});
test.afterEach(async ({ page }) => {
  expect(page.__reportErrors).toEqual([]);
  expect(page.__reportNetwork).toEqual([]);
});

test('filters combine and clearing them restores all tests', async ({ page }) => {
  await expect(page.locator('#shown')).toHaveText('3 / 3 tests');
  await page.getByLabel('runner', { exact: true }).selectOption('playwright');
  await page.getByLabel('status', { exact: true }).selectOption('flaky');
  await expect(page.locator('#selection-stream > article:visible')).toHaveCount(1);
  await expect(page.locator('#selection-stream > article:visible')).toContainText('Payment retries successfully');
  await expect(page.locator('#shown')).toHaveText('1 / 3 tests');
  await page.getByLabel('runner', { exact: true }).selectOption('');
  await page.getByLabel('status', { exact: true }).selectOption('');
  await expect(page.locator('#selection-stream > article:visible')).toHaveCount(3);
});

test('empty searches clear every view and recover without stale selections', async ({ page }) => {
  await page.getByRole('searchbox').fill('no matching scenario');
  await expect(page.locator('#empty')).toBeVisible();
  await expect(page.locator('#shown')).toHaveText('0 / 3 tests');
  await page.getByRole('button', { name: 'Heatmap & triage', exact: true }).click();
  await expect(page.locator('#heatmap-body tr')).toHaveCount(0);
  await page.getByRole('button', { name: 'Split inspector', exact: true }).click();
  await expect(page.locator('#inspector-rail button')).toHaveCount(0);
  await expect(page.locator('#inspector-drawer article')).toHaveCount(0);
  await page.getByRole('searchbox').fill('');
  await expect(page.locator('#inspector-rail button')).toHaveCount(3);
  await expect(page.locator('#inspector-drawer')).toContainText('Checkout completes');
  await expect(page.locator('#empty')).toBeHidden();
});

test('keyboard users can switch views, select tests, and expand retries', async ({ page }) => {
  const view = page.getByRole('button', { name: 'Split inspector', exact: true });
  await view.focus(); await page.keyboard.press('Enter');
  await expect(view).toHaveAttribute('aria-pressed', 'true');
  const retry = page.locator('#inspector-rail button').filter({ hasText: 'Payment retries successfully' });
  await retry.focus(); await page.keyboard.press('Space');
  await expect(retry).toHaveClass(/active/);
  await expect(page.locator('#inspector-drawer h3')).toHaveText('Payment retries successfully');
  await page.locator('#inspector-drawer summary').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#inspector-drawer details')).toHaveAttribute('open', '');
  await expect(page.locator('#inspector-drawer h4')).toHaveCount(2);
});

test('Escape closes the recording, clears its source, and restores keyboard focus', async ({ page }) => {
  const opener = page.locator('#selection-stream [data-theater]');
  await opener.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#theater-modal')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close recording' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#theater-modal')).toBeHidden();
  await expect(opener).toBeFocused();
  await expect.poll(() => page.locator('#theater-player').getAttribute('src')).toBeNull();
  await expect.poll(() => page.locator('#theater-player').evaluate(video => video.paused)).toBe(true);
});

test('theme selection survives reload in the offline report', async ({ page }) => {
  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('report stays within a narrow viewport and every view remains usable', async ({ page }) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const name of ['Heatmap & triage', 'Split inspector', 'Visual gallery']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

for (const theme of ['dark', 'light']) for (const view of ['gallery', 'heatmap', 'inspector']) {
  test(`${view} ${theme} visual baseline`, async ({ page }, info) => {
    test.skip(process.platform !== 'linux' || process.arch !== 'x64' || Boolean(process.env.SATURDAY_BROWSER_CHANNEL), 'Pixel baselines require the pinned Linux amd64 bundled Chromium; interaction checks run on every platform.');
    test.skip(info.project.name === 'mobile' && view !== 'gallery', 'Desktop baselines cover the detailed views; mobile interaction tests cover their layout.');
    if (theme === 'light') await page.getByRole('button', { name: 'Toggle theme' }).click();
    await page.locator(`[data-view="${view}"]`).click();
    // Native video pixels are dynamic; playback is checked separately by the packed-consumer suite.
    await expect(page).toHaveScreenshot(`${view}-${theme}.png`, { fullPage: true, mask: [page.locator('video')] });
  });
}
