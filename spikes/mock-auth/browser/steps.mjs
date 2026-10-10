import {createRequire} from 'node:module';
import {launch,journey} from './journeys.mjs';
const {BeforeAll,AfterAll,Given,setDefaultTimeout}=createRequire('/work/testing/package.json')('@cucumber/cucumber');
setDefaultTimeout(60000);
let browser;
BeforeAll(async()=>{browser=await launch();});
AfterAll(async()=>{await browser?.close();});
Given('I exercise isolated mock scenario {string}',async scenario=>{await journey(browser,scenario,'cucumber');});
