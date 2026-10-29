import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export const artifactFamilies=['browser-debian','browser-ubi9','auth-lessons','password-otp','certificate-password','authentik','rfc8705','magic-shop-reports','evidence-consumer','evidence-checkout','evidence-reporting','evidence-idempotency','evidence-regional'];
export function selectArtifacts(pages,id,sha,attempt){
 assert.ok(Number.isSafeInteger(id)&&id>0);assert.match(sha,/^[a-f0-9]{40}$/);assert.ok(Number.isSafeInteger(attempt)&&attempt>0);
 const artifacts=pages.flatMap(p=>p.artifacts);
 return artifactFamilies.map(family=>{
  const pattern=new RegExp(`^${family}-${id}-([0-9]+)$`);
  const candidates=artifacts.filter(a=>pattern.test(a.name)).map(a=>({...a,attempt:Number(a.name.match(pattern)[1])}));
  assert.ok(candidates.length,`Missing ${family} evidence`);
  assert.equal(new Set(candidates.map(a=>a.attempt)).size,candidates.length,'Duplicate artifact attempt');
  assert.ok(candidates.every(a=>a.attempt>0&&a.attempt<=attempt),'Future artifact attempt');
  const selected=candidates.sort((a,b)=>b.attempt-a.attempt)[0];
  assert.equal(selected.expired,false,'Latest evidence expired');
  assert.equal(selected.workflow_run.id,id);assert.equal(selected.workflow_run.head_sha,sha);
  return selected.name;
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 console.log(selectArtifacts(JSON.parse(readFileSync(process.argv[2])),Number(process.argv[3]),process.argv[4],Number(process.argv[5])).join('\n'));
}
