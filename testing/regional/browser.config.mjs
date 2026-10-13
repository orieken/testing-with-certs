import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:import.meta.dirname,testMatch:'browser.spec.mjs',timeout:60000,workers:1,retries:0,outputDir:'/home/runner/browser-results',reporter:[['list']],use:{channel:process.env.LAB_BROWSER,headless:true,launchOptions:{slowMo:100},ignoreHTTPSErrors:false,trace:'off',screenshot:'off'}});
