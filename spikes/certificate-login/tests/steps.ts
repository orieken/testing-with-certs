import {Before,After,Given,When,Then,setDefaultTimeout} from '@cucumber/cucumber';
import {SaturdayWorld,installSaturdayWorld} from '@orieken/saturday-cucumber';
import {chromium,expect} from '@playwright/test';
import {trace,type Span} from '@opentelemetry/api';
import {certificates} from './certificates.js';
import {LandingSite} from './site.js';
setDefaultTimeout(45000);
installSaturdayWorld();
const spans=new WeakMap<SaturdayWorld,Span>();
Before(async function(this:SaturdayWorld){
  const channel=process.env.LAB_BROWSER;
  if(channel!=='chrome'&&channel!=='msedge') throw new Error('invalid_browser');
  spans.set(this,trace.getTracer('certificate-spike').startSpan('certificate-login'));
  this.browser=await chromium.launch({channel,timeout:30000});
  this.context=await this.browser.newContext({clientCertificates:certificates('customer'),ignoreHTTPSErrors:false});
  this.page=await this.context.newPage();
  this.page.setDefaultTimeout(10000);
  this.page.setDefaultNavigationTimeout(20000);
});
After(async function(this:SaturdayWorld){
  await this.context?.close();
  await this.browser?.close();
  spans.get(this)?.end();
});
Given('a selected customer certificate',function(this:SaturdayWorld){expect(this.context).toBeDefined();});
When('the customer signs in to the landing app',async function(this:SaturdayWorld){await new LandingSite(this.page).login();});
Then('Keycloak identifies the customer without a password',async function(this:SaturdayWorld){
  await expect(this.page.locator('#status')).toHaveText('Authenticated: customer');
  await expect(this.page.locator('#identity')).toContainText('customer');
  await expect(this.page.locator('input[type=password]')).toHaveCount(0);
});
