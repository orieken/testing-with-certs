import { BasePage, BaseSite } from '@orieken/saturday-core';
import type { Page } from '@playwright/test';

export class InventoryPage extends BasePage {
  get containerSelector() { return 'body'; }
  get path() { return '/inventory'; }
  constructor(page: Page, site: BaseSite) { super(page, site); }
  protected initializeElements(): void {}
  protected initializeFilters(): void {}
  async createItem(name: string): Promise<void> {
    await this.page.getByLabel('Name').fill(name);
    await this.page.getByLabel('Description').fill('Synthetic shopkeeper UI role check');
    await this.page.getByLabel('Local image path').fill('/images/wand-embers.png');
    await this.page.getByLabel('Price (copper)').fill('1234');
    await this.page.getByRole('button', { name: 'Create item' }).click();
  }
  async archiveItem(name: string): Promise<void> {
    const row = this.page.locator('div.border-t').filter({ has: this.page.getByText(name, { exact: true }) });
    this.page.once('dialog', dialog => { void dialog.accept(); });
    await row.getByRole('button', { name: 'Archive' }).click();
  }
}
