import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:import.meta.dirname,testMatch:'provider.spec.mjs',timeout:60000,workers:1,retries:0,outputDir:'/home/runner/test-results',reporter:[['./reporter.mjs']],use:{ignoreHTTPSErrors:false,trace:'off',screenshot:'off',video:'off'}});
