import{test}from'node:test';import assert from'node:assert/strict';
import{verifyFullRun,fullJobNames,publicationJob}from'./pages-evidence.mjs';
import{selectArtifacts,artifactFamilies}from'./pages-artifacts.mjs';
import{canPublish,waitForPublication}from'./pages-release.mjs';
const sha='a'.repeat(40);
function active(){return {status:'in_progress',conclusion:null,event:'workflow_dispatch',headSha:sha,headBranch:'main',databaseId:123,url:'https://github.com/orieken/testing-with-certs/actions/runs/123',jobs:[...fullJobNames.map(name=>({name,status:'completed',conclusion:'success'})),{name:publicationJob,status:'in_progress',conclusion:null}]};}
const options={publishing:true,context:{runId:'123',sha,branch:'main',attempt:'1'}};
test('active publication requires all native gates and binds the current run, source, branch and publisher',()=>{
 assert.equal(verifyFullRun(active(),options).jobs.length,19);
 for(const mutate of [r=>r.jobs.pop(),r=>r.jobs[0].conclusion='failure',r=>r.jobs[0].conclusion='skipped',r=>r.jobs[0].status='in_progress',r=>r.databaseId=124,r=>r.headSha='b'.repeat(40),r=>r.headBranch='untrusted',r=>r.jobs.push(r.jobs[0]),r=>r.jobs.at(-1).conclusion='failure',r=>r.event='pull_request']){const r=active();mutate(r);assert.throws(()=>verifyFullRun(r,options));}
 assert.throws(()=>verifyFullRun(active()));assert.throws(()=>verifyFullRun(active(),{publishing:true}));
 const done=active();done.status='completed';done.conclusion='success';Object.assign(done.jobs.at(-1),{status:'completed',conclusion:'success'});assert.equal(verifyFullRun(done).jobs.length,19);
 done.jobs.at(-1).conclusion='failure';assert.throws(()=>verifyFullRun(done));
});
function artifacts(){return [{artifacts:artifactFamilies.map(name=>({name:`${name}-123-1`,expired:false,workflow_run:{id:123,head_sha:sha}}))}];}
test('artifact selection handles successful retries without mixing runs, sources or expired evidence',()=>{
 const pages=artifacts();pages.push({artifacts:[{name:'auth-lessons-123-2',expired:false,workflow_run:{id:123,head_sha:sha}}]});
 const selected=selectArtifacts(pages,123,sha,2);assert.equal(selected.length,12);assert.ok(selected.includes('auth-lessons-123-2'));assert.ok(!selected.includes('auth-lessons-123-1'));
 for(const mutate of [p=>p[0].artifacts.pop(),p=>p[1].artifacts[0].expired=true,p=>p[1].artifacts[0].workflow_run.head_sha='b'.repeat(40),p=>p[1].artifacts[0].workflow_run.id=124,p=>p[1].artifacts[0].name='auth-lessons-123-3',p=>p[1].artifacts.push(p[1].artifacts[0])]){const bad=structuredClone(pages);mutate(bad);assert.throws(()=>selectArtifacts(bad,123,sha,2));}
});
test('an older full run cannot replace a newer publication',()=>{
 const candidate={databaseId:123,headSha:sha};const current={evidence:'verified-full-native-test-run',runId:124,sourceCommit:sha};assert.equal(canPublish(current,candidate),false);assert.equal(canPublish(null,candidate),true);current.runId=122;assert.equal(canPublish(current,candidate),true);current.runId=123;assert.equal(canPublish(current,candidate),true);current.publicationAttempt=2;assert.equal(canPublish(current,candidate),false);candidate.attempt=3;assert.equal(canPublish(current,candidate),true);current.sourceCommit='b'.repeat(40);assert.throws(()=>canPublish(current,candidate));assert.throws(()=>canPublish({},candidate));
});
test('deployment propagation never accepts stale provenance as the new report',async()=>{
 const expected={runId:123,sourceCommit:sha,publicationAttempt:2};let calls=0;
 assert.deepEqual(await waitForPublication(expected,{read:async()=>++calls===1?{...expected,publicationAttempt:1}:expected,wait:async()=>{},attempts:2}),expected);
 assert.equal(calls,2);
 await assert.rejects(()=>waitForPublication(expected,{read:async()=>({...expected,sourceCommit:'b'.repeat(40)}),wait:async()=>{},attempts:2}));
 await assert.rejects(()=>waitForPublication(expected,{read:async()=>{throw Error('network unavailable');},wait:async()=>{},attempts:2}));
});
