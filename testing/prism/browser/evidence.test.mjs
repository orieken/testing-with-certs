import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSelection, scenarios } from './check-evidence.mjs';
function rows(){return scenarios.map(scenario=>({runner:'playwright',browser:'chrome',scenario,evidence:'prism-mock-browser-consumer',passed:true,pkce:true,noLeaks:true,prismCalls:3,deliveredMockOrders:scenario.startsWith('checkout-')?1:0,checkoutRequests:2,sameKeyReplay:true,injectedFaults:1,faultElapsedMs:10100,observedStatuses:[200,201,403,409,422,503]}));}
test('TEST-07 gate rejects missing, duplicate, failed, wrong-provenance and missing-video results',()=>{
  checkSelection(rows(),'playwright','chrome',()=>true);
  for(const mutate of [value=>value.pop(),value=>{value[1]=value[0];},value=>{value[0].passed=false;},value=>{value[0].evidence='playwright-contracts';}]){
    const value=rows();mutate(value);assert.throws(()=>checkSelection(value,'playwright','chrome',()=>true));
  }
  assert.throws(()=>checkSelection(rows(),'playwright','chrome',()=>false));
});
test('TEST-07 gate rejects duplicate orders, extra retries, missing faults and deadline violations',()=>{
  for(const [scenario,key,value] of [['checkout-409','deliveredMockOrders',2],['checkout-422','checkoutRequests',3],['checkout-503','sameKeyReplay',false],['catalog-wrong-type','injectedFaults',0],['checkout-delay','faultElapsedMs',100],['checkout-403','observedStatuses',[200,201]],['catalog-empty','noLeaks',false]]){
    const invalid=rows();invalid.find(row=>row.scenario===scenario)[key]=value;assert.throws(()=>checkSelection(invalid,'playwright','chrome',()=>true));
  }
});
