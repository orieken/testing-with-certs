import { expect } from '@playwright/test';

export async function expectRegionalOrderIds(table, ids, options = {}) {
  // Retry count, ordering, and cell contents together across report replacements.
  await expect(table.locator('tbody tr td:first-child')).toHaveText(ids, options);
}
