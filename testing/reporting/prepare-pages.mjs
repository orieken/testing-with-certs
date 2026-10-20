import assert from 'node:assert/strict';
import{readdirSync,readFileSync,writeFileSync,mkdirSync}from'node:fs';
import{resolve,join}from'node:path';
import{execFileSync}from'node:child_process';
import{verifyFullRun,finalizePages}from'./pages-evidence.mjs';
import{scanArtifacts}from'../container/check-artifacts.mjs';
import{checkBrowserMatrix}from'./check-browser-matrix.mjs';
import{checkAuthMatrix}from'./check-auth-matrix.mjs';
import{indexAuthRecordings}from'./auth-recording-index.mjs';
import{checkAuthentikEvidence}from'./check-authentik.mjs';
import{artifactFamilies as families}from'./pages-artifacts.mjs';
const project=resolve('.'),root=resolve(process.argv[2]),site=resolve(process.argv[5]);
const run=JSON.parse(readFileSync(process.argv[3])),id=String(run.databaseId);
const options=process.env.PAGES_ACTIVE_RUN==='1'?{publishing:true,context:{runId:process.env.GITHUB_RUN_ID,sha:process.env.GITHUB_SHA,branch:process.env.GITHUB_REF_NAME,attempt:process.env.GITHUB_RUN_ATTEMPT}}:{};
verifyFullRun(run,options);
const artifacts={};const checks=[];const matrices=[];
for(const family of families){const names=readdirSync(root).filter(n=>new RegExp(`^${family}-${id}-[0-9]+$`).test(n));assert.equal(names.length,1,`Exactly one accepted ${family} bundle required`);artifacts[family]=join(root,names[0]);checks.push({artifact:names[0],scanned:await scanArtifacts(artifacts[family],{requireMountedPath:false})});}
for(const os of ['debian','ubi9']){const path=artifacts[`browser-${os}`];const result=checkBrowserMatrix(path,os);matrices.push(result.manifest);checks.push({suite:`browser-${os}`,selections:result.selections,cleanup:readFileSync(join(path,'matrix-cleanup.txt'),'utf8').trim()});}
for(const family of ['auth-lessons','password-otp','certificate-password']){const path=artifacts[family];const recordings=indexAuthRecordings(family,path);if(family!=='certificate-password')assert.equal(checkAuthMatrix(family,path),recordings.cases);checks.push({suite:family,...recordings});matrices.push(join(path,'recording-matrix.json'));}
const authentik=checkAuthentikEvidence(artifacts.authentik);checks.push({suite:'authentik',...authentik,cleanup:readFileSync(join(artifacts.authentik,'cleanup.txt'),'utf8').trim(),lifecycleCleanup:readFileSync(join(artifacts.authentik,'lifecycle-cleanup.txt'),'utf8').trim()});matrices.push(join(artifacts.authentik,'recording-matrix.json'));
for(const family of families.filter(n=>n.startsWith('evidence-'))){const m=JSON.parse(readFileSync(join(artifacts[family],'manifest.json')));assert.equal(m.runOutcome,'success');assert.equal(m.failureCleanupOutcome,'success');checks.push({suite:family,source:m.source,run:m.runOutcome,failureCleanup:m.failureCleanupOutcome});}
const combined=join(root,'combined');mkdirSync(combined);const target=join(combined,'matrix.json');writeFileSync(target,JSON.stringify({id:`native-full-${id}-${options.context?.attempt||1}`,status:'passed',passed:0,failed:0,rows:[]}));
const operator=resolve(process.argv[4]);
for(const args of [['matrix-merge',target,...matrices],['matrix-site',target,site]])process.stderr.write(execFileSync(operator,['--root',project,'--project','magic-shop',...args],{encoding:'utf8'}));
mkdirSync(join(root,'independent-checks'));writeFileSync(join(root,'independent-checks/evidence.json'),JSON.stringify({runId:id,sourceCommit:run.headSha,checks},null,2)+'\n');
const result=await finalizePages(site,root,run,options);console.log(JSON.stringify(result));
