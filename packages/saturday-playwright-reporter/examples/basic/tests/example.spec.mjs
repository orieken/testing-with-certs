import { test, expect } from '@playwright/test';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
if (process.env.SATURDAY_INTERRUPT) test('interrupt me', async () => {
  console.log('SATURDAY_INTERRUPT_READY');
  await new Promise(resolve => setTimeout(resolve, 20000));
});
test('a test with steps and an attachment', async ({}, info) => {
  await test.step('check the answer', async () => expect(6 * 7).toBe(42));
  await info.attach('tiny screenshot', { body: png, contentType: 'image/png' });
});
test('no recording required', { annotation: { type: 'saturday', description: 'recording=disabled' } }, () => {
  expect(true).toBe(true);
});
test.skip('a skipped test', () => {});
test('a retry keeps both attempts', ({}, info) => {
  if (process.env.SATURDAY_EDGE_CASES && info.retry === 0) throw new Error('Deliberate first-attempt failure');
  expect(true).toBe(true);
});
if (process.env.SATURDAY_BROWSER) {
  test('a recorded page', async ({ browser }) => {
    const context = await browser.newContext({ recordVideo: { dir: 'test-results/videos' } });
    const page = await context.newPage();
    await page.setContent('<h1>Saturday recording example</h1>');
    await expect(page.locator('h1')).toHaveText('Saturday recording example');
    const video = page.video();
    await context.close();
    await test.info().attach('Video', { path: await video.path(), contentType: 'video/webm' });
  });
}
if (process.env.SATURDAY_EDGE_CASES) {
  test('a failed test', () => { throw new Error('Raw failure detail must stay outside the portable report'); });
  test('a timeout', async () => { test.setTimeout(100); await new Promise(resolve => setTimeout(resolve, 1000)); });
  test('an expected failure', () => { test.fail(); expect(1).toBe(2); });
  test('an unexpected pass', () => { test.fail(); expect(1).toBe(1); });
  test.describe('suite A', () => { test('duplicate title', () => {}); });
  test.describe('suite B', () => { test('duplicate title', () => {}); });
  test('hostile <img src=x onerror="window.pwned=1"> title', () => {});
}
