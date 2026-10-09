
import { BasePage, BaseSite } from '@orieken/saturday-core';
import { Page } from '@playwright/test';

export class ProductDetailsPage extends BasePage {
  get containerSelector() { return 'body'; }
  get path() { return '/item/:id'; }

  constructor(page: Page, site: BaseSite) {
    super(page, site);
  }

  protected initializeElements(): void {}
  protected initializeFilters(): void {}

  async isDetailsVisible() {
    await this.page.locator('[data-testid="add-to-cart-btn"]').waitFor();
    await this.page.locator('h2').waitFor();
  }
}
