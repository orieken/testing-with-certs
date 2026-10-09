import {chromium,expect} from '@playwright/test';
import {LandingSite} from './site.js';
const channel=process.env.LAB_BROWSER;
if(channel!=='chrome'&&channel!=='msedge') throw new Error('invalid_browser');
const context=await chromium.launchPersistentContext(`${process.env.HOME}/native-profile`,{channel,headless:false,timeout:30000,ignoreHTTPSErrors:false});
try {
  const page=await context.newPage();
  page.setDefaultTimeout(15000);
  const policy=await context.newPage();
  await policy.goto(channel==='chrome'?'chrome://policy':'edge://policy',{timeout:15000});
  await expect(policy.locator('body')).toContainText('AutoSelectCertificateForUrls');
  await new LandingSite(page).login();
  await expect(page.locator('#status')).toHaveText(`Authenticated: ${process.env.LAB_USER??'customer'}`);
  console.log(`${channel}: native certificate login and policy name observed`);
} finally {await context.close();}
