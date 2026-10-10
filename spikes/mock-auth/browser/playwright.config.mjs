import {createRequire} from 'node:module';
const {defineConfig}=createRequire('/work/testing/package.json')('@playwright/test');
export default defineConfig({testDir:'.',testMatch:'browser.spec.mjs',timeout:60000,workers:1,retries:0,outputDir:'/tmp/mock-results',reporter:[['list']],use:{channel:process.env.LAB_BROWSER,headless:true,launchOptions:{slowMo:120}}});
