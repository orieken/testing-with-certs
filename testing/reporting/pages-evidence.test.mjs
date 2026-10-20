import{test}from'node:test';import assert from'node:assert/strict';
import{mkdtempSync,mkdirSync,writeFileSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';
import{verifyFullRun,fullJobNames,checkPages}from'./pages-evidence.mjs';
function run(){return {status:'completed',conclusion:'success',event:'workflow_dispatch',headSha:'a'.repeat(40),databaseId:123,url:'https://github.com/orieken/testing-with-certs/actions/runs/123',jobs:fullJobNames.map(name=>({name,status:'completed',conclusion:'success'}))};}
test('public provenance requires all 19 real jobs and a successful explicit full run',()=>{
 assert.equal(verifyFullRun(run()).jobs.length,19);
 for(const mutate of [r=>r.jobs.pop(),r=>r.jobs[0].conclusion='failure',r=>r.jobs[0].conclusion='skipped',r=>r.event='push',r=>r.conclusion='cancelled',r=>r.jobs[1]=r.jobs[0]]){const r=run();mutate(r);assert.throws(()=>verifyFullRun(r));}
});
test('public site validation rejects missing links and credential material',async()=>{
 const root=mkdtempSync(join(tmpdir(),'pages-check-'));try{
  mkdirSync(join(root,'reports'));writeFileSync(join(root,'reports/a.webm'),'video');writeFileSync(join(root,'matrix.json'),JSON.stringify({status:'passed',rows:[{status:'passed',video_count:1}]}));writeFileSync(join(root,'index.html'),'<a href="reports/a.webm">video</a>');
  assert.equal((await checkPages(root,1)).videos,1);
  writeFileSync(join(root,'index.html'),'<a href="missing.webm">video</a>');await assert.rejects(()=>checkPages(root,1));
  writeFileSync(join(root,'index.html'),'<a href="../outside">escape</a>');await assert.rejects(()=>checkPages(root,1));
  writeFileSync(join(root,'index.html'),'<a href="reports/a.webm">video</a>');writeFileSync(join(root,'private.key'),'private');await assert.rejects(()=>checkPages(root,1));
 }finally{rmSync(root,{recursive:true,force:true});}
});
