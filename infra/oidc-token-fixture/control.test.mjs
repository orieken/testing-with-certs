import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
test('relay control requires its private credential, exclusive ownership and explicit release', async () => {
  // Run in an isolated container with a synthetic /state/client-secret mount.
  const secret=readFileSync('/state/client-secret','utf8');
  const server=spawn(process.execPath,[new URL('./server.mjs',import.meta.url).pathname],{stdio:'ignore'});
  const url='http://127.0.0.1:9102';
  for(let attempt=0;attempt<40;attempt++){
    try{if((await fetch(url+'/health')).ok)break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  async function request(path='/control',data,credential=secret) {
    const response=await fetch(url+path,{method:data?'POST':'GET',headers:{authorization:`Bearer ${credential}`,'content-type':'application/json'},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(5000)});
    return {status:response.status,value:await response.json()};
  }
  const owned={provider:'keycloak',owner:randomUUID(),kind:'issuer'};
  try {
    assert.equal((await request('/health',undefined,'wrong')).status,200);
    assert.equal((await request('/control',undefined,'wrong')).status,403);
    assert.equal((await request('/control',undefined,'x'.repeat(secret.length))).status,403);
    assert.equal((await request('/control',{...owned,action:'arm'},'wrong')).status,403);
    assert.deepEqual((await request()).value,{idle:true});
    assert.equal((await request('/control',{...owned,provider:'unowned',action:'arm'})).status,400);
    assert.equal((await request('/control',{...owned,kind:'unrecognized',action:'arm'})).status,409);
    assert.equal((await request('/control',{...owned,action:'arm'})).status,200);
    assert.deepEqual((await request()).value,{idle:false});
    for(const action of ['arm','status','release'])assert.equal((await request('/control',{...owned,owner:randomUUID(),action})).status,409);
    assert.deepEqual((await request('/control',{...owned,action:'status'})).value,{kind:'issuer',applied:0,originalVerified:false});
    assert.equal((await request('/control',{...owned,action:'release'})).status,200);
    assert.deepEqual((await request()).value,{idle:true});
    assert.equal((await request('/unowned/jwks')).status,404);
  } finally { if(server.exitCode===null){const closed=once(server,'exit');server.kill('SIGTERM');await closed;} }
});
test('JWKS faults require their owner, return observed HTTP failures and release to an idle fixture',async()=>{
 const secret=readFileSync('/state/client-secret','utf8');
 const server=spawn(process.execPath,[new URL('./server.mjs',import.meta.url).pathname],{stdio:'ignore'});
 const url='http://127.0.0.1:9102';
 for(let n=0;n<40;n++){try{if((await fetch(url+'/health')).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
 const owner=randomUUID(),headers={authorization:`Bearer ${secret}`,'content-type':'application/json'};
 const control=(action,mode,selectedOwner=owner)=>fetch(url+'/control',{method:'POST',headers,body:JSON.stringify({provider:'keycloak',owner:selectedOwner,action,mode,kind:'jwks-cached-key-outage'})});
 try{
  assert.equal((await control('arm')).status,200);
  assert.equal((await control('jwks-mode','unavailable',randomUUID())).status,409);
  assert.equal((await control('jwks-mode','unrecognized')).status,400);
  assert.equal((await (await control('status')).json()).mode,'healthy');
  for(const mode of ['unavailable','malformed','empty']){
   assert.equal((await control('jwks-mode',mode)).status,200);
   const response=await fetch(url+'/keycloak/jwks');
   assert.equal(response.status,mode==='unavailable'?503:200);
   const body=await response.text();
   if(mode==='malformed')assert.throws(()=>JSON.parse(body));
   if(mode==='empty')assert.deepEqual(JSON.parse(body),{keys:[]});
  }
  const status=await (await control('status')).json();assert.equal(status.jwksFailures,3);assert.equal(status.jwksRequests,3);
  assert.equal((await control('release')).status,200);
  assert.deepEqual(await (await fetch(url+'/control',{headers})).json(),{idle:true});
 }finally{if(server.exitCode===null){const closed=once(server,'exit');server.kill('SIGTERM');await closed;}}
});
test('native Keycloak control rejects invalid credentials, paths and action scopes before administration',async()=>{
 const secret=readFileSync('/state/client-secret','utf8');
 const server=spawn(process.execPath,[new URL('./key-control.mjs',import.meta.url).pathname],{stdio:'ignore'});
 const url='http://127.0.0.1:9103';
 for(let n=0;n<40;n++){try{if((await fetch(url+'/health')).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
 async function request(path,action,owner=randomUUID(),credential=secret){return fetch(url+path,{method:'POST',headers:{authorization:`Bearer ${credential}`,'content-type':'application/json'},body:JSON.stringify({action,owner}),signal:AbortSignal.timeout(5000)});}
 try{
  assert.equal((await request('/keycloak','start',randomUUID(),'x'.repeat(secret.length))).status,403);
  assert.equal((await request('/realms/master','rotate')).status,404);
  assert.equal((await request('/authentik','rotate')).status,404);
  assert.equal((await request('/keycloak','unsupported')).status,400);
  assert.equal((await request('/keycloak','start','invalid-owner')).status,400);
  assert.equal((await request('/refresh/unowned','start')).status,404);
  assert.equal((await request('/refresh/keycloak','rotate')).status,400);
  assert.equal((await request('/refresh/broker','start','invalid-owner')).status,400);
  assert.equal((await request('/refresh/authentik-broker','start','invalid-owner')).status,400);
  assert.equal((await request('/sessions/unowned','revoke')).status,404);
  assert.equal((await request('/sessions/upstream-session-revoked','rotate')).status,400);
  assert.equal((await request('/sessions/upstream-session-revoked','revoke','invalid-owner')).status,400);
 }finally{if(server.exitCode===null){const closed=once(server,'exit');server.kill('SIGTERM');await closed;}}
});
