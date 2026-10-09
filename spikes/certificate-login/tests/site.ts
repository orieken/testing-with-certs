import {BaseElement,BasePage,BaseFlow,BaseSite} from '@orieken/saturday-core';
import type {Page} from 'playwright';
export const shop='https://shop.magic.test:8443';
export const auth='https://auth.magic.test:9443';
class LoginButton extends BaseElement {}
class LandingPage extends BasePage {
  containerSelector='main';
  path='/';
  protected initializeElements(){this.registerElement('login',LoginButton,'#login');}
  protected initializeFilters(){}
  async signIn(){await this.getElement('login').click();}
}
class CertificateLogin extends BaseFlow {
  async execute(){await this.getPage<LandingPage>('landing').signIn();}
}
export class LandingSite extends BaseSite {
  constructor(page:Page){super(page,shop);}
  protected initializePages(){this.registerPage('landing',LandingPage);}
  protected initializeFlows(){this.registerFlow('login',CertificateLogin);}
  async login(){await this.pageObject.goto(shop,{timeout:20000}); await this.getFlow('login').execute();}
}
