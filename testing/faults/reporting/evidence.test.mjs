import assert from 'node:assert/strict';
import { test } from 'node:test';
import { check } from './check-evidence.mjs';
function fixture(){
 const results=[];const add=evidence=>results.push({name:`${evidence.kind}-${evidence.mode}`,status:'passed',evidence:[evidence]});
 for(const kind of ['sales','customers','orders']){
  for(const mode of ['conflict','revision','outage','repeat'])add({kind,mode,status:['conflict','revision'].includes(mode)?409:503,calls:2,upstreamAuthorization:true,partial:false,recovery:200,elapsedMs:1,boundMs:10000});
  add({kind,mode:'empty',status:200,calls:3,partial:false});
 }
 for(const [mode,status,calls]of [['exact',200,100],['over',503,101],['loop',503,101]])add({kind:'sales',mode,status,calls,partial:false,recovery:200,elapsedMs:1,boundMs:30000});
 add({kind:'boundary',mode:'tls-schema',verifiedTls:true,negativeTls:4,authorizationNegatives:2,invalidFixtureRejectedByAjv:true,mokapiDoesNotEnforceScriptResponse:true});
 return {source:'real-insights-scripted-dependency-faults',mokapi:'0.52.0',specDigests:{customer:'test',insights:'test'},results};
}
test('reporting gate rejects missing, duplicate, failed and wrong provenance/schema evidence',()=>{
 const base=fixture();check(base,base.specDigests);
 const mutations=[r=>r.results.pop(),r=>r.results[1]=r.results[0],r=>r.results[0].status='failed',r=>r.source='live-contracts',r=>r.specDigests.customer='wrong'];
 for(const mutate of mutations){const r=structuredClone(base);mutate(r);assert.throws(()=>check(r,base.specDigests));}
});
test('reporting gate rejects partial totals, hidden retries, unbounded reads and weakened TLS',()=>{
 const base=fixture();const mutations=[r=>r.results[0].evidence[0].partial=true,r=>r.results[0].evidence[0].calls=3,r=>r.results[0].evidence[0].recovery=503,r=>r.results[0].evidence[0].elapsedMs=10000,r=>r.results.at(-1).evidence[0].verifiedTls=false,r=>r.results.find(x=>x.evidence[0].mode==='loop').evidence[0].calls=102];
 for(const mutate of mutations){const r=structuredClone(base);mutate(r);assert.throws(()=>check(r,base.specDigests));}
});
