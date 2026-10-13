import assert from 'node:assert/strict';
import {copyFileSync,existsSync,lstatSync,mkdirSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const types={consumer:['prism','cert-prism','prism-mock-browser-consumer'],checkout:['checkout-faults','magic-shop-checkout-fault','real-checkout-dependency-faults'],reporting:['reporting-faults','magic-shop-reporting-fault','real-insights-scripted-dependency-faults'],idempotency:['checkout-idempotency','magic-shop-checkout-idempotency','real-provider-checkout-idempotency'],regional:['regional','magic-shop-regional','live-regional-provider']};
const allowed=new Set(['results.json','provider.json','compatibility.json','browser-evidence.json','browser.jsonl','observations.jsonl','environment.json','environment.txt','versions.json','images.txt','compose-version.txt','cleanup.txt']);
function copy(directory,target){
 if(!existsSync(directory))return;
 mkdirSync(target,{recursive:true});
 for(const file of readdirSync(directory)){const from=resolve(directory,file),to=resolve(target,file);const stat=lstatSync(from);assert.ok(!stat.isSymbolicLink());if(stat.isDirectory())copy(from,to);else if(allowed.has(file)){assert.ok(stat.size<=20_000_000);copyFileSync(from,to);}}
}
function outcome(value){assert.ok(['success','failure','cancelled','skipped'].includes(value));return value;}
function required(source,suite){const file=suite==='consumer'?'browser-evidence.json':suite==='regional'?'provider.json':'results.json';assert.ok(existsSync(`${source}/${file}`),'Required evidence report missing');const report=JSON.parse(readFileSync(`${source}/${file}`));assert.equal(report.source,types[suite][2]);if(suite==='consumer'){assert.equal(report.cases,44);assert.equal(report.results.length,44);assert.ok(report.results.every(row=>row.passed===true));}else{assert.ok(report.results.length>0);assert.ok(report.results.every(row=>row.status==='passed'));}}
export function manifest(suite,id,result,probe){assert.ok(types[suite]);assert.match(id,/^[a-z0-9-]+$/);return {schemaVersion:1,suite,source:types[suite][2],execution:process.env.GITHUB_ACTIONS==='true'?'native-github-ci':'local-container',runOutcome:outcome(result),failureCleanupOutcome:outcome(probe),liveProviderGateCredit:false,videosExported:false};}
export function prepare(suite,id,result,probe,root='/work'){
 const data=manifest(suite,id,result,probe),[group,prefix]=types[suite];const source=`${root}/artifacts/${group}/${prefix}-ci-${id}`;const target=`${root}/artifacts/ci-evidence/${suite}`;
 if(result==='success')required(source,suite);
 if(suite==='reporting')copy(`${root}/artifacts/${group}/magic-shop-mokapi-probe-ci-${id}`,`${target}/compatibility`);
 copy(source,`${target}/run`);copy(`${source}-failure`,`${target}/intentional-failure`);mkdirSync(target,{recursive:true});writeFileSync(`${target}/manifest.json`,JSON.stringify(data,null,2)+'\n');console.log(`PASS: allowlisted ${suite} text reports; no live-provider gate credit`);
}
if(process.argv[1]?.endsWith('/report.mjs'))prepare(...process.argv.slice(2));
