import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkNativeRfc8705} from './native-rfc8705.mjs';
const run={databaseId:123,headSha:'a'.repeat(40)};
function fixture(){return {
 'provenance.json':{evidence:'native-rfc8705-recorded-run',workflowRunId:'123',workflowAttempt:1,sourceCommit:run.headSha,sourceDirty:false,selections:['chrome','msedge']},
 'cleanup.json':{status:'passed',containersAbsent:true,volumesAbsent:true,networksAbsent:true},
 'playback.json':{status:'passed',selections:2,videos:10,results:['chrome','msedge'].map(channel=>({channel,clipsDecodedAndAdvanced:10,filters:'passed',pageErrors:0}))},
};}
function check(files){const root=mkdtempSync(join(tmpdir(),'native-rfc8705-'));try{
 for(const [name,value]of Object.entries(files))writeFileSync(join(root,name),JSON.stringify(value));
 for(const browser of ['chrome','msedge']){mkdirSync(join(root,browser,'checks'),{recursive:true});writeFileSync(join(root,browser,'privacy.json'),'{}');for(let i=1;i<=6;i++)writeFileSync(join(root,browser,'checks',`case-${i}.json`),'{}');}
 return checkNativeRfc8705(root,run,2);
}finally{rmSync(root,{recursive:true,force:true});}}
test('native RFC evidence rejects local, stale, dirty, incomplete playback and failed cleanup provenance',()=>{
 assert.equal(check(fixture()).videos,10);
 for(const mutate of [f=>f['provenance.json'].evidence='local-rfc8705-recorded-run',f=>f['provenance.json'].workflowRunId='122',f=>f['provenance.json'].workflowAttempt=3,f=>f['provenance.json'].sourceCommit='b'.repeat(40),f=>f['provenance.json'].sourceDirty=true,f=>f['playback.json'].results.pop(),f=>f['playback.json'].results[0].clipsDecodedAndAdvanced=9,f=>f['cleanup.json'].containersAbsent=false]){const files=fixture();mutate(files);assert.throws(()=>check(files));}
});
