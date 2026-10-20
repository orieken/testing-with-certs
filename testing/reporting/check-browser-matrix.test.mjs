import{test}from'node:test';import assert from'node:assert/strict';
import{mkdtempSync,mkdirSync,writeFileSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';
import{checkBrowserMatrix}from'./check-browser-matrix.mjs';
test('full native browser evidence rejects missing, repeated, wrong-OS and failed selections',()=>{
 const root=mkdtempSync(join(tmpdir(),'full-matrix-'));try{
  const examples=[['playwright','customer-waterdeep','teaching'],['playwright','shop-admin','teaching'],['playwright','shopkeeper','teaching'],['cucumber','customer-waterdeep','teaching'],['cucumber','shop-admin','teaching'],['playwright','customer-waterdeep','recorded'],['playwright','shop-admin','recorded']];
  const rows=[];mkdirSync(join(root,'matrix/run'),{recursive:true});
  for(const browser of ['chrome','msedge'])for(const [runner,user,suite]of examples){const report=`../../reports/${rows.length}`;const path=join(root,'reports',String(rows.length));mkdirSync(path,{recursive:true});writeFileSync(join(path,'environment.json'),JSON.stringify({os:'debian',browser,architecture:'x64',browserVersion:'real fixture version'}));rows.push({os:'debian',browser,runner,user,suite,report,status:'passed',video_count:1});}
  const manifest={status:'passed',passed:14,failed:0,rows};const path=join(root,'matrix/run/matrix.json');const save=value=>writeFileSync(path,JSON.stringify(value));save(manifest);assert.equal(checkBrowserMatrix(root,'debian').selections,14);
  for(const mutate of [m=>m.rows.pop(),m=>m.rows[1]=m.rows[0],m=>m.rows[0].os='ubi9',m=>m.rows[0].status='failed',m=>m.rows[0].video_count=0]){const copy=structuredClone(manifest);mutate(copy);save(copy);assert.throws(()=>checkBrowserMatrix(root,'debian'));}
 }finally{rmSync(root,{recursive:true,force:true});}
});
