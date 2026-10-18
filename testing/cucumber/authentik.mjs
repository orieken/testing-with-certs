import {BeforeAll,AfterAll,Given,setDefaultTimeout} from '@cucumber/cucumber';
import * as playwright from '@playwright/test';
import {checkAuthentik} from '../teaching/authentik.mjs';
let browser;
setDefaultTimeout(90000);
BeforeAll(async()=>{if(!['chrome','msedge'].includes(process.env.LAB_BROWSER))throw new Error('Real browser required');browser=await playwright.chromium.launch({channel:process.env.LAB_BROWSER,headless:true,args:['--disable-http2']});});
AfterAll(async()=>{await browser?.close();});
Given('the authentik check {string} passes',async function(name){await checkAuthentik(browser,name,playwright);});
