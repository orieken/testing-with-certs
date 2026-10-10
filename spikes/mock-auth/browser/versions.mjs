import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const require=createRequire('/work/testing/package.json');
const details={node:process.version,playwright:require('@playwright/test/package.json').version,cucumber:require('@cucumber/cucumber/package.json').version,chrome:execFileSync('google-chrome',['--version'],{encoding:'utf8'}).trim(),edge:execFileSync('microsoft-edge',['--version'],{encoding:'utf8'}).trim(),platform:process.platform,arch:process.arch};
writeFileSync('/reports/versions.json',JSON.stringify(details,null,2));console.log(details);
