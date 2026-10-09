import { BasePage, BaseSite } from '@orieken/saturday-core';
import type { Page } from '@playwright/test';

export class AccountPage extends BasePage {
  get containerSelector() { return 'body'; }
  get path() { return '/account'; }
  constructor(page: Page, site: BaseSite) { super(page, site); }
  protected initializeElements(): void {}
  protected initializeFilters(): void {}
  async setRecentOrdersWidget(enabled: boolean): Promise<void> {
    const widget = this.page.getByRole('checkbox', { name: 'Recent orders' });
    if (enabled) await widget.check(); else await widget.uncheck();
    await this.page.getByRole('button', { name: 'Save widgets' }).click();
  }
}
