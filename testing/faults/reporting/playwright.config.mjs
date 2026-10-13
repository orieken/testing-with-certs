import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:import.meta.dirname,testMatch:'reporting.spec.mjs',timeout:60000,workers:1,retries:0,outputDir:'/home/runner/test-results',use:{ignoreHTTPSErrors:false,trace:'off',screenshot:'off',video:'off'},reporter:[['./reporter.mjs']]});
