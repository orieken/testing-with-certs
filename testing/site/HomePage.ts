import { BasePage, BaseSite, ButtonElement } from '@orieken/saturday-core';
import type { Page } from '@playwright/test';

export class HomePage extends BasePage {
  get containerSelector() { return 'body'; }
  get path() { return '/'; }
  constructor(page: Page, site: BaseSite) { super(page, site); }
  protected initializeElements(): void {
    this.registerElement('certificateSignIn', ButtonElement, 'button:has-text("Sign in with certificate")');
  }
  protected initializeFilters(): void {}
  async signIn(): Promise<void> { await this.getElement<ButtonElement>('certificateSignIn').click(); }
  async signOut(): Promise<void> { await this.page.getByRole('button', { name: 'Sign out' }).click(); }
  async openAccount(): Promise<void> { await this.page.getByRole('link', { name: 'Account' }).click(); }
  async openAdmin(): Promise<void> { await this.page.getByRole('link', { name: 'Admin' }).click(); }
  async openInventory(): Promise<void> { await this.page.getByRole('link', { name: 'Inventory' }).click(); }
  async openLocations(): Promise<void> { await this.page.getByRole('link', { name: 'Locations' }).click(); }
  async addItem(name: string): Promise<void> {
    await this.page.getByTestId('item-card').filter({ hasText: name }).getByRole('button', { name: 'Add to Cart' }).click();
  }
  async openCart(): Promise<void> { await this.page.getByRole('link', { name: /Cart/ }).click(); }
  async openItem(name: string): Promise<void> { await this.page.getByTestId('item-name').filter({ hasText: name }).click(); }
}
