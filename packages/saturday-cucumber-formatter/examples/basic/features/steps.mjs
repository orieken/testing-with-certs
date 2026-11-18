import { BeforeAll, AfterAll, Before, After, Given, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
let browser;
const attempts = new Map();
BeforeAll(async () => {
  if (process.env.SATURDAY_BROWSER) browser = await chromium.launch({ ...(process.env.SATURDAY_BROWSER_CHANNEL ? { channel: process.env.SATURDAY_BROWSER_CHANNEL } : {}) });
});
AfterAll(async () => { await browser?.close(); });
Before(function ({ pickle }) {
  this.attempt = attempts.get(pickle.id) ?? 0;
  attempts.set(pickle.id, this.attempt + 1);
});
Before({ tags: '@hook-failure' }, () => { throw new Error('Deliberate hook failure'); });
Before({ tags: '@video' }, async function () {
  if (!browser) return;
  this.context = await browser.newContext({ recordVideo: { dir: 'test-results/videos' } });
  this.page = await this.context.newPage();
});
After(async function () {
  if (!this.context) return;
  const video = this.page.video();
  await this.context.close(); // Finalize the recording before attaching it.
  await this.attach(await readFile(await video.path()), { mediaType: 'video/webm', fileName: 'Scenario video' });
});
Given('the answer is {int}', function (answer) { assert.ok(answer >= 42); });
Then('a screenshot is attached', async function () { await this.attach(png, { mediaType: 'image/png', fileName: 'Screenshot' }); });
Given('a page is displayed', async function () {
  if (this.page) { await this.page.setContent('<h1>Saturday recording example</h1>'); assert.equal(await this.page.locator('h1').textContent(), 'Saturday recording example'); }
});
Given('a deliberate failure', () => { throw new Error('Raw failure detail must stay outside the portable report'); });
Given('a pending implementation', () => 'pending');
Given('a skipped implementation', () => 'skipped');
Given('an ambiguous implementation', () => {});
Given('an ambiguous implementation', () => {});
Given('a retry succeeds', function () { assert.ok(this.attempt > 0); });
