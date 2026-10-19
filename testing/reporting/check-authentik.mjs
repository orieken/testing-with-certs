import assert from 'node:assert/strict';
import {readFileSync,readdirSync,lstatSync,writeFileSync} from 'node:fs';
import {resolve,join,relative,dirname,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import {authentikCaseNames,authentikPhase} from '../teaching/provider-matrix.mjs';
export function checkAuthentikEvidence(root){
 root=resolve(root);
 function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const path=join(dir,e.name);assert.ok(!e.isSymbolicLink(),'Provider report symlink');return e.isDirectory()?walk(path):[path];});}
 const files=walk(root),seen=new Set(),rows=[];
 const records=files.filter(p=>p.endsWith('/recording.json')).map(path=>({path,value:JSON.parse(readFileSync(path))}));
 assert.equal(records.length,authentikCaseNames.length*4,'Missing or extra authentik executions');
 for(const browser of ['chrome','msedge'])for(const runner of ['playwright','cucumber']){
  const report=JSON.parse(readFileSync(join(root,`${browser}-${runner}/results.json`)));
  assert.equal(report.evidence,'live-authentik-broker');assert.equal(report.browser,browser);assert.equal(report.runner,runner);
  assert.deepEqual(report.cases.map(c=>c.name).sort(),[...authentikCaseNames].sort());assert.ok(report.cases.every(c=>c.status==='passed'));
  for(const phase of ['baseline','lifecycle'])for(const method of ['oidc','saml']){
   const selected=records.filter(r=>r.value.browser===browser&&r.value.runner===runner&&r.value.auth_type===`authentik-${method}`&&r.value.phase===phase);
   const expected=authentikCaseNames.filter(n=>n.startsWith(`authentik-${method}:`)&&authentikPhase(n)===phase);
   assert.deepEqual(selected.map(r=>r.value.name).sort(),[...expected].sort());
   const group=join(root,'recordings',`${browser}-${runner}-${phase}`,`authentik-${method}`),cases=[];
   for(const {path,value:r} of selected){
    assert.equal(r.evidence,'live-authentication-recording');assert.equal(r.status,'passed');assert.equal(r.phase,phase);assert.equal(r.privacy,'provider-document-hidden-before-paint');assert.equal(r.spec,`teaching/authentik${phase==='lifecycle'?'-lifecycle':''}.mjs`);assert.ok(r.videos.length);
    for(const video of r.videos){const full=resolve(root,video),rel=relative(dirname(path),full);assert.ok(rel&&!rel.startsWith('..'));assert.ok(!seen.has(full));seen.add(full);const stat=lstatSync(full);assert.ok(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0);cases.push({path:relative(group,full),spec:r.spec,name:r.name,status:r.status});}
   }
   writeFileSync(join(group,'video-cases.json'),JSON.stringify({evidence:'verified-authentication-video-cases',cases},null,2)+'\n');
   rows.push({os:'debian',browser,runner,user:'isolated authentik fixtures',suite:`authentik-${method}-${phase}`,auth_type:method,run_id:`${basename(root)}-${browser}-${runner}-${method}-${phase}`,report:relative(root,group),status:'passed',summary:`${expected.length} real authentik broker scenarios passed`});
  }
 }
 const videos=files.filter(p=>/\.(webm|mp4)$/i.test(p));assert.equal(videos.length,seen.size);assert.ok(videos.every(p=>seen.has(p)));
 writeFileSync(join(root,'recording-matrix.json'),JSON.stringify({id:basename(root),status:'passed',passed:rows.length,failed:0,rows},null,2)+'\n');
 return {cases:authentikCaseNames.length*4,videos:seen.size,selections:rows.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(checkAuthentikEvidence(process.argv[2]));
