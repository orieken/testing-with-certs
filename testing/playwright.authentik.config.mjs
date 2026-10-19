import {defineConfig} from '@playwright/test';
if(!['chrome','msedge'].includes(process.env.LAB_BROWSER))throw new Error('Real browser channel required');
export default defineConfig({testDir:'./playwright',testMatch:'authentik.spec.mjs',workers:1,maxFailures:1,retries:0,timeout:90000,outputDir:'/tmp/authentik-results',reporter:'./reporting/authentik.mjs',use:{channel:process.env.LAB_BROWSER,headless:true,launchOptions:{args:['--disable-http2']},ignoreHTTPSErrors:false,trace:'off',screenshot:'off',video:'off'}});
