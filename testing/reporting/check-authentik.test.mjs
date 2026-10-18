import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {authentikCaseNames} from '../teaching/provider-matrix.mjs';
import {checkAuthentikEvidence} from './check-authentik.mjs';
function fixture(root){
 for(const browser of ['chrome','msedge'])for(const runner of ['playwright','cucumber']){
  const report=join(root,`${browser}-${runner}`);mkdirSync(report,{recursive:true});
  writeFileSync(join(report,'results.json'),JSON.stringify({evidence:'live-authentik-broker',browser,runner,cases:authentikCaseNames.map(name=>({name,status:'passed'}))}));
  for(const [i,name] of authentikCaseNames.entries()){
   const method=name.split(':')[0],dir=`recordings/${browser}-${runner}-baseline/${method}/${i}`;
   mkdirSync(join(root,dir),{recursive:true});writeFileSync(join(root,dir,'page.webm'),'fixture');
   writeFileSync(join(root,dir,'recording.json'),JSON.stringify({evidence:'live-authentication-recording',browser,runner,name,auth_type:method,phase:'baseline',status:'passed',privacy:'provider-document-hidden-before-paint',spec:'teaching/authentik.mjs',videos:[`${dir}/page.webm`]}));
  }
 }
}
test('authentik gate requires complete passing real-provider selections and safe recordings',()=>{
 const root=mkdtempSync(join(tmpdir(),'authentik-gate-'));
 try{
  fixture(root);assert.deepEqual(checkAuthentikEvidence(root),{cases:56,videos:56,selections:8});
  const file=join(root,'chrome-playwright/results.json'),original=readFileSync(file);
  for(const mutate of [r=>r.cases.pop(),r=>r.cases[0].status='failed',r=>r.evidence='mock-provider',r=>r.browser='msedge',r=>r.cases[1]=r.cases[0]]){
   const report=JSON.parse(original);mutate(report);writeFileSync(file,JSON.stringify(report));assert.throws(()=>checkAuthentikEvidence(root));
  }
  writeFileSync(file,original);symlinkSync(file,join(root,'unsafe'));assert.throws(()=>checkAuthentikEvidence(root));
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('both runners enumerate every required authentik scenario exactly once',()=>{
 const feature=readFileSync(new URL('../cucumber/features/authentik.feature',import.meta.url),'utf8');
 const names=[...feature.matchAll(/\| (authentik-[^ |]+) \|/g)].map(m=>m[1]);
 assert.deepEqual(names.sort(),[...authentikCaseNames].sort());assert.equal(new Set(names).size,14);
});
