import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
const browsers={};
for(const channel of ['chrome','msedge']){const browser=await chromium.launch({channel,headless:true});try{browsers[channel]=browser.version();}finally{await browser.close();}}
writeFileSync('/work/artifacts/auth-lessons/environment.json',JSON.stringify({evidence:'real-authentik-browser-runtime',node:process.version,platform:process.platform,architecture:process.arch,browsers},null,2)+'\n');
