import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { mkdir, appendFile, rename } from 'node:fs/promises';
import { item, order } from '../fixtures.mjs';
import { installRoutes } from './routes.mjs';
import { shop, auth } from './auth.mjs';
const {expect,chromium}=createRequire('/work/testing/package.json')('@playwright/test');
export const scenarios=['catalog-populated','catalog-empty','catalog-wrong-type','checkout-409','checkout-422','checkout-503','checkout-403','checkout-malformed-json','checkout-oversized','checkout-delay','checkout-disconnect'];
export const launch=()=>chromium.launch({channel:process.env.LAB_BROWSER,headless:true,slowMo:120,timeout:30000});
async function catalogJourney(page,state,scenario) {
  await expect(page.getByTestId('item-card')).toContainText(item.name);
  if(scenario==='catalog-empty')state.catalogEmpty=true;
  if(scenario==='catalog-wrong-type')state.fault=scenario;
  await page.getByRole('button',{name:'Search',exact:true}).click();
  if(scenario==='catalog-empty'){await expect(page.getByRole('status')).toContainText('No wares found.');await expect(page.getByTestId('item-card')).toHaveCount(0);}
  if(scenario==='catalog-wrong-type'){await expect(page.getByRole('alert')).toContainText('Catalog is unavailable.');await expect(page.getByTestId('item-card')).toHaveCount(0);}
  state.catalogEmpty=false;
  await page.getByRole('button',{name:'Search',exact:true}).click();await expect(page.getByTestId('item-card')).toContainText(item.name);
  await expect(page.getByRole('alert')).toHaveCount(0);assert.equal(state.deliveredOrders,0);
}
async function checkoutJourney(page,state,scenario) {
  state.fault=scenario;
  await expect(page.getByTestId('item-card')).toContainText(item.name);
  await page.getByTestId('item-card').getByRole('button',{name:'Add to Cart'}).click();await page.getByRole('link',{name:/Cart/}).click();
  await expect(page.getByLabel('Order region')).toHaveValue('waterdeep');
  const button=page.getByRole('button',{name:'Place simulated order'});const started=performance.now();await button.click();
  if(scenario==='checkout-delay')await expect(button).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('Your cart is still here',{timeout:14000});
  state.faultElapsedMs=Math.round(performance.now()-started);
  if(scenario==='checkout-delay')assert.ok(state.faultElapsedMs>=9500&&state.faultElapsedMs<14000,'Existing 10-second UI deadline is bounded');
  await expect(page.getByTestId('cart-item')).toHaveCount(1);await expect(page.getByRole('status').filter({hasText:'created. Total:'})).toHaveCount(0);
  assert.equal(state.deliveredOrders,0);assert.equal(state.checkoutKeys.length,1);assert.equal(state.injectedFaults,1);
  await expect(button).toBeEnabled();await button.click();
  await expect(page.getByRole('status').filter({hasText:'created. Total:'})).toContainText(order.orderId);
  await expect(page.getByTestId('cart-empty')).toBeVisible();assert.equal(state.deliveredOrders,1);assert.equal(state.checkoutKeys.length,2);
  assert.equal(state.checkoutKeys[0],state.checkoutKeys[1],'Manual recovery reuses one idempotency key');
  await page.getByRole('link',{name:'Account',exact:true}).click();await expect(page.getByText(order.orderId,{exact:true})).toHaveCount(1);
}
export async function journey(browser,scenario,runner) {
  assert.ok(scenarios.includes(scenario));const dir=`/reports/${runner}-${process.env.LAB_BROWSER}`;await mkdir(dir,{recursive:true});
  const identity={cert:readFileSync('/identity/cert.pem'),key:readFileSync('/identity/key.pem')};
  const context=await browser.newContext({viewport:{width:1440,height:900},ignoreHTTPSErrors:false,serviceWorkers:'block',clientCertificates:[{origin:shop,...identity},{origin:auth,...identity}],recordVideo:{dir,size:{width:1440,height:900}}});
  const page=await context.newPage();const name=`${runner}-${process.env.LAB_BROWSER}-${scenario}`;
  const state={pkce:false,codeExchanges:0,prismCalls:0,checkoutKeys:[],deliveredOrders:0,injectedFaults:0,violations:0,blocked:0,observedStatuses:[],timers:new Set(),catalogEmpty:false,fault:null};
  let passed=false;
  try {
    await installRoutes(context,state,scenario,name);
    await context.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{const badge=document.createElement('div');badge.textContent='TEST-07 · MOCK AUTH · PRISM API · UI CONSUMER EVIDENCE';badge.style.cssText='position:fixed;bottom:8px;right:8px;background:#382700;color:#ffe49b;padding:8px;font:14px Arial;z-index:99999;pointer-events:none';document.body.appendChild(badge);}));
    const probe=await context.request.get(`${shop}/harness-audit`);assert.equal(probe.status(),200);
    await page.goto(shop,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Sign in with certificate'}).click();
    await expect(page.getByTestId('signed-in-user')).toContainText('prism-customer');assert.equal(state.pkce,true);assert.equal(state.codeExchanges,1);
    if(scenario.startsWith('catalog-'))await catalogJourney(page,state,scenario);else await checkoutJourney(page,state,scenario);
    assert.equal(state.violations,0);assert.equal(state.blocked,0);assert.ok(state.prismCalls>0);
    const audit=await context.request.get(`${shop}/harness-audit`);assert.deepEqual(await audit.json(),{apiLeaks:0,authLeaks:0});
    assert.equal(await page.evaluate(()=>[...Object.values(localStorage),...Object.values(sessionStorage)].some(value=>/eyJ[A-Za-z0-9_-]{30}/.test(value))),false);
    await page.waitForTimeout(800);passed=true;
  }finally {
    for(const timer of state.timers)clearTimeout(timer);
    await context.close();await rename(await page.video().path(),`${dir}/${scenario}.webm`);
    await appendFile(`${dir}/observations.jsonl`,JSON.stringify({schemaVersion:1,evidence:'prism-mock-browser-consumer',runner,browser:process.env.LAB_BROWSER,scenario,passed,pkce:state.pkce,prismCalls:state.prismCalls,observedStatuses:state.observedStatuses,deliveredMockOrders:state.deliveredOrders,checkoutRequests:state.checkoutKeys.length,sameKeyReplay:state.checkoutKeys.length===2?state.checkoutKeys[0]===state.checkoutKeys[1]:null,injectedFaults:state.injectedFaults,faultElapsedMs:state.faultElapsedMs??null,noLeaks:state.violations===0&&state.blocked===0})+'\n');
  }
}
