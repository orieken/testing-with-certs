import { BaseSite } from '@orieken/saturday-core';
import type { Page } from '@playwright/test';
import { HomePage } from './HomePage.js';
import { CartPage } from './CartPage.js';
import { ProductDetailsPage } from './ProductDetailsPage.js';
import { AccountPage } from './AccountPage.js';
import { AdminPage } from './AdminPage.js';
import { InventoryPage } from './InventoryPage.js';
import { CertificateLoginFlow } from './CertificateLoginFlow.js';

export class MagicShop extends BaseSite {
  constructor(page: Page, baseURL = 'https://shop.magic.test:8443') {
    super(page, baseURL);
  }

  protected initializePages(): void {
    this.registerPage('home', HomePage);
    this.registerPage('cart', CartPage);
    this.registerPage('productDetails', ProductDetailsPage);
    this.registerPage('account', AccountPage);
    this.registerPage('admin', AdminPage);
    this.registerPage('inventory', InventoryPage);
  }

  protected initializeFlows(): void { this.registerFlow('certificateLogin', CertificateLoginFlow); }

  get home(): HomePage { return this.getPage<HomePage>('home'); }
  get cart(): CartPage { return this.getPage<CartPage>('cart'); }
  get productDetails(): ProductDetailsPage { return this.getPage<ProductDetailsPage>('productDetails'); }
  get account(): AccountPage { return this.getPage<AccountPage>('account'); }
  get admin(): AdminPage { return this.getPage<AdminPage>('admin'); }
  get inventory(): InventoryPage { return this.getPage<InventoryPage>('inventory'); }
  get certificateLogin(): CertificateLoginFlow { return this.getFlow<CertificateLoginFlow>('certificateLogin'); }
}
