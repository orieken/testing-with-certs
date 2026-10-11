import { createRequire } from 'node:module';
import { launch,journey } from './journeys.mjs';
const {BeforeAll,AfterAll,Given,setDefaultTimeout}=createRequire('/work/testing/package.json')('@cucumber/cucumber');
setDefaultTimeout(60000);let browser;
BeforeAll(async()=>{browser=await launch();});AfterAll(async()=>{await browser?.close();});
Given('I verify live regional scenario {string}',async scenario=>journey(browser,scenario,'cucumber'));
