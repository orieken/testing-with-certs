import { BaseFlow } from '@orieken/saturday-core';
import type { HomePage } from './HomePage.js';

export class CertificateLoginFlow extends BaseFlow {
  async execute(): Promise<void> {
    const home = this.getPage<HomePage>('home');
    await home.visit();
    await home.signIn();
  }
}
