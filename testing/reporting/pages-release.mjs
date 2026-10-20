import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';import{pathToFileURL}from'node:url';
export const pagesURL='https://orieken.github.io/testing-with-certs/';
export function canPublish(current,candidate){
 assert.ok(Number.isSafeInteger(candidate.databaseId)&&candidate.databaseId>0);
 if(current===null)return true;
 assert.equal(current.evidence,'verified-full-native-test-run');assert.ok(Number.isSafeInteger(current.runId)&&current.runId>0);
 if(current.runId===candidate.databaseId){
  assert.equal(current.sourceCommit,candidate.headSha,'Same run has a different source');
  const attempt=candidate.attempt??1;assert.ok(Number.isSafeInteger(attempt)&&attempt>0);
  return (current.publicationAttempt??1)<=attempt;
 }
 return current.runId<=candidate.databaseId;
}
export async function publishedProvenance(key){
 const response=await fetch(`${pagesURL}test-run.json?publication=${encodeURIComponent(key)}`,{signal:AbortSignal.timeout(20000),cache:'no-store'});
 if(response.status===404)return null;
 assert.equal(response.status,200,'Cannot inspect current publication');return response.json();
}
export async function waitForPublication(expected,{read=()=>publishedProvenance(`${expected.runId}-${expected.publicationAttempt}`),wait=()=>new Promise(resolve=>setTimeout(resolve,5000)),attempts=12}={}){
 for(let attempt=0;attempt<attempts;attempt++){
  let current;try{current=await read();}catch(error){if(attempt===attempts-1)throw error;}
  if(current&&Object.entries(expected).every(([name,value])=>current[name]===value))return current;
  if(attempt<attempts-1)await wait();
 }
 throw Error('Public provenance does not match this deployment');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const candidate=JSON.parse(readFileSync(process.argv[2]));console.log(canPublish(await publishedProvenance(`${candidate.databaseId}-${process.env.GITHUB_RUN_ATTEMPT}`),candidate));
}
