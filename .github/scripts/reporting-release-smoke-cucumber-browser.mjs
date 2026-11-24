import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function writeBrowserCucumberFixture(directory, version) {
  mkdirSync(join(directory, 'features'), { recursive: true });
  writeFileSync(join(directory, 'cucumber.mjs'), `export default {
    import:['features/steps.mjs'],parallel:0,retry:1,
    format:['progress','@orieken/saturday-cucumber-formatter:saturday-formatter.log'],
    formatOptions:{saturday:{outputDir:process.env.SMOKE_REPORT??'saturday-report',title:'Published browser Cucumber ${version} smoke',metadata:{team:'npm-smoke',fixture:'browser-cucumber'}}}
  };\n`);
  writeFileSync(join(directory, 'features/smoke.feature'), `Feature: Published browser Cucumber formatter
  Background:
    Given a rendered browser checkout
    When I confirm the browser checkout
  Scenario: Browser Cucumber passes with real media
    Then the browser checkout succeeds
  Scenario: Browser Cucumber retry is reported as flaky
    Then the browser checkout succeeds on retry
  Scenario: Browser Cucumber deliberate failure is preserved
    Then the browser checkout deliberately fails
`);
  writeFileSync(join(directory, 'features/steps.mjs'), `import {BeforeAll,AfterAll,Before,After,Given,When,Then,setDefaultTimeout} from '@cucumber/cucumber';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
setDefaultTimeout(30000);
let browser;
const attempts=new Map(),receipts=[];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
BeforeAll(async()=>{await mkdir('test-results',{recursive:true});browser=await chromium.launch({headless:true});});
AfterAll(async()=>{try{await browser?.close();}finally{await writeFile('test-results/producer-media.json',JSON.stringify(receipts,null,2));}});
Before(async function({pickle}){
  this.title=pickle.name;this.attempt=attempts.get(pickle.id)??0;attempts.set(pickle.id,this.attempt+1);
  this.context=await browser.newContext({viewport:{width:640,height:360},recordVideo:{dir:'test-results/videos',size:{width:640,height:360}}});
  this.page=await this.context.newPage();
  await this.page.setContent('<!doctype html><html><head><title>Cucumber media smoke</title><style>body{margin:0;padding:28px;background:#101827;color:#f8fafc;font:16px system-ui}h1{color:#38bdf8;font-size:26px}button{padding:12px 22px;background:#34d399;border:0;border-radius:8px;font:inherit}#status{padding:12px;border:1px solid #475569;border-radius:8px}small{color:#94a3b8}</style></head><body><h1>Saturday browser Cucumber</h1><p id="scenario"></p><button>Confirm order</button><p id="status">Ready for checkout</p><small id="attempt"></small></body></html>');
  await this.page.getByRole('button',{name:'Confirm order'}).evaluate(element=>element.addEventListener('click',()=>document.querySelector('#status').textContent='Order confirmed'));
  await this.page.locator('#scenario').evaluate((element,title)=>element.textContent=title,this.title);
  await this.page.locator('#attempt').evaluate((element,index)=>element.textContent='Recording attempt '+(index+1),this.attempt);
});
After(async function(){
  if(!this.context)return;
  const video=this.page?.video();let png;
  try{
    if(this.page){
      // Keep the rendered checkout visible long enough to record real frames on every attempt.
      await this.page.waitForTimeout(350);
      png=await this.page.screenshot();
      await this.attach(png,{mediaType:'image/png',fileName:'Checkout screenshot attempt '+(this.attempt+1)});
    }
  }finally{await this.context.close();}
  assert.ok(video,'A recording is required for every browser scenario attempt');
  const webm=await readFile(await video.path()); // Context closure finalizes the WebM before attachment.
  await this.attach(webm,{mediaType:'video/webm',fileName:'Checkout recording attempt '+(this.attempt+1)});
  receipts.push({title:this.title,attempt:this.attempt,png:hash(png),webm:hash(webm)});
});
Given('a rendered browser checkout',async function(){assert.equal(await this.page.locator('h1').innerText(),'Saturday browser Cucumber');});
When('I confirm the browser checkout',async function(){await this.page.getByRole('button',{name:'Confirm order'}).click();});
Then('the browser checkout succeeds',async function(){assert.equal(await this.page.locator('#status').innerText(),'Order confirmed');});
Then('the browser checkout succeeds on retry',async function(){assert.equal(await this.page.locator('#status').innerText(),'Order confirmed');if(this.attempt===0)throw new Error('SMOKE_RAW_PRIVATE_ERROR');});
Then('the browser checkout deliberately fails',function(){throw new Error('SMOKE_RAW_PRIVATE_ERROR');});
`);
}
