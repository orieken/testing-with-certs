import { BasePage, BaseSite } from '@orieken/saturday-core';
import type { Page } from '@playwright/test';

export class AdminPage extends BasePage {
  get containerSelector() { return 'body'; }
  get path() { return '/admin'; }
  constructor(page: Page, site: BaseSite) { super(page, site); }
  protected initializeElements(): void {}
  protected initializeFilters(): void {}
  async showSeptemberWaterdeep(): Promise<void> {
    await this.page.getByLabel('From (UTC)').fill('2026-09-01');
    await this.page.getByLabel('To (exclusive, UTC)').fill('2026-10-01');
    await this.page.getByRole('button', { name: 'Refresh report' }).click();
    await this.page.getByRole('combobox', { name: 'Region' }).selectOption('waterdeep');
  }
}
