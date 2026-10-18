import { test, expect } from '@playwright/test';
import { includedIds } from './fixtures.mjs';
import { expectRegionalOrderIds } from './report-assertions.mjs';

const ids = includedIds.slice(0, 25);
const markup = values => values.map(id => `<tr><td>${id}</td></tr>`).join('');

test('exact IDs recover after the table clears between count and text reads', async ({ page }) => {
  await page.setContent(`<table><tbody>${markup(ids)}</tbody></table>`);
  const table = page.locator('table');
  await expect(table.locator('tbody tr')).toHaveCount(25);
  await page.evaluate(html => {
    document.querySelector('tbody').innerHTML = '';
    setTimeout(() => { document.querySelector('tbody').innerHTML = html; }, 250);
  }, markup(ids));
  // Demonstrate the old immediate snapshot's failure window without failing this test.
  expect(await table.locator('tbody tr td:first-child').allTextContents()).toEqual([]);
  await expectRegionalOrderIds(table, ids);
});

test('25 rows with incorrect IDs still fail the exact-content assertion', async ({ page }) => {
  await page.setContent(`<table><tbody>${markup([...ids].reverse())}</tbody></table>`);
  await expect(page.locator('tbody tr')).toHaveCount(25);
  await expect(expectRegionalOrderIds(page.locator('table'), ids, { timeout: 300 })).rejects.toThrow();
});
