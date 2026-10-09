import { BasePage, BaseSite } from '@orieken/saturday-core';
import type { Page } from '@playwright/test';

export class CartPage extends BasePage {
  get containerSelector() { return 'body'; }
  get path() { return '/cart'; }
  constructor(page: Page, site: BaseSite) { super(page, site); }
  protected initializeElements(): void {}
  protected initializeFilters(): void {}
  async removeItem(name: string): Promise<void> {
    await this.page.getByTestId('cart-item').filter({ hasText: name }).getByTestId('remove-item-btn').click();
  }
  async placeOrder(region: string): Promise<void> {
    await this.page.getByLabel('Order region').fill(region);
    await this.page.getByRole('button', { name: 'Place simulated order' }).click();
  }
}
