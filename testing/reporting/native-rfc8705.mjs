import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
export function checkNativeRfc8705(root,run,attempt){
 const read=name=>JSON.parse(readFileSync(join(root,name)));
 const provenance=read('provenance.json'),playback=read('playback.json'),cleanup=read('cleanup.json');
 assert.equal(provenance.evidence,'native-rfc8705-recorded-run');
 assert.equal(provenance.workflowRunId,String(run.databaseId));
 assert.equal(provenance.sourceCommit,run.headSha);assert.equal(provenance.sourceDirty,false);
 assert.ok(Number.isSafeInteger(provenance.workflowAttempt)&&provenance.workflowAttempt>0&&provenance.workflowAttempt<=attempt);
 assert.deepEqual(provenance.selections,['chrome','msedge']);
 assert.equal(cleanup.status,'passed');
 for(const name of ['containersAbsent','volumesAbsent','networksAbsent'])assert.equal(cleanup[name],true);
 assert.equal(playback.status,'passed');assert.equal(playback.selections,2);assert.ok(playback.videos>0);
 assert.deepEqual(playback.results.map(r=>r.channel).sort(),['chrome','msedge']);
 for(const result of playback.results){assert.equal(result.clipsDecodedAndAdvanced,playback.videos);assert.equal(result.filters,'passed');assert.equal(result.pageErrors,0);}
 const checks=provenance.selections.map(browser=>({browser,privacy:read(`${browser}/privacy.json`),assertions:Array.from({length:6},(_,i)=>read(`${browser}/checks/case-${i+1}.json`))}));
 const evidence={suite:'rfc8705',provenance,cleanup,playback,checks};
 mkdirSync(join(root,'native-evidence'),{recursive:true});writeFileSync(join(root,'native-evidence/evidence.json'),JSON.stringify(evidence,null,2));
 return {suite:'rfc8705',workflowAttempt:provenance.workflowAttempt,selections:2,videos:playback.videos};
}
