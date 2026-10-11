import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { validateHttpResponse, validateJsonRequest } from '/work/testing/api/contracts/validator.ts';
import { mockRequest } from '../request.mjs';
import { FAULT_wrong_type, FAULT_json, FAULT_oversized } from '../fixtures.mjs';
import { authMock, shop, auth } from './auth.mjs';
const operations={
  'GET /api/catalog/items':['catalog','listItems','populated'],
  'GET /api/customer/me':['customer','getMyProfile','profile'],
  'GET /api/customer/me/widgets':['customer','getMyWidgets','widgets'],
  'GET /api/customer/orders':['customer','listMyOrders','orders'],
  'POST /api/customer/orders':['customer','createOrder','created']
};
function isWrongCatalog(route,state){return state.fault==='catalog-wrong-type'&&route.request().url().includes('/api/catalog/items');}
function isCheckoutFault(route,state,scenario){return state.fault&&scenario.startsWith('checkout-')&&route.request().method()==='POST';}
async function injectCheckoutFault(route,fault,state,response){
  if(fault==='checkout-disconnect'){await route.abort('connectionreset');return;}
  if(fault==='checkout-delay'){
    const timer=setTimeout(()=>{state.timers.delete(timer);void route.abort('timedout').catch(()=>{});},11000);state.timers.add(timer);return;
  }
  if(fault==='checkout-malformed-json'){await route.fulfill({status:201,contentType:'application/json',headers:{location:response.headers.location},body:FAULT_json});return;}
  if(fault==='checkout-oversized'){await route.fulfill({status:201,headers:{'content-type':'application/json',location:response.headers.location,'content-length':String(Buffer.byteLength(FAULT_oversized))},body:FAULT_oversized});return;}
  // Canonical structured failures came from Prism.
  await route.fulfill({status:response.status,headers:response.headers,body:response.rawBody});
}
async function deliver(route,state,scenario,response) {
  if(isWrongCatalog(route,state)){
    state.fault=null;state.injectedFaults++;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(FAULT_wrong_type)});return;
  }
  if(!isCheckoutFault(route,state,scenario)){
    if(response.status===201)state.deliveredOrders++;
    await route.fulfill({status:response.status,headers:response.headers,body:response.rawBody});return;
  }
  const fault=state.fault;state.fault=null;state.injectedFaults++;
  await injectCheckoutFault(route,fault,state,response);
}
function checkoutPreference(state,request,body){
  validateJsonRequest('customer','createOrder',body);const key=request.headers()['idempotency-key'];assert.match(key,/^[a-zA-Z0-9_-]{16,128}$/);
  state.checkoutKeys.push(key);
  if(state.fault&&/^checkout-(403|409|422|503)$/.test(state.fault)){const status=Number(state.fault.slice(9));return {status,selected:`error${status}`};}
  return {status:201,selected:'created'};
}
async function api(route,url,state,scenario) {
  const request=route.request();assert.ok(request.headers().authorization?.startsWith('Bearer '),'Synthetic UI bearer shape present');
  const method=request.method(),op=operations[`${method} ${url.pathname}`];assert.ok(op,'Known isolated mock operation');
  const [service,operation,example]=op,body=request.postData()?request.postDataJSON():undefined;
  let {status,selected}=method==='POST'?checkoutPreference(state,request,body):{status:200,selected:example};
  if(operation==='listItems')selected=state.catalogEmpty?'empty':'populated';
  const response=await mockRequest(`${url.pathname}${url.search}`,{method,body,prefer:`code=${status}, example=${selected}`,idempotencyKey:request.headers()['idempotency-key']});
  validateHttpResponse(service,operation,status,response);state.prismCalls++;state.observedStatuses.push(status);
  await deliver(route,state,scenario,response);
}
export async function installRoutes(context,state,scenario,name) {
  const authRoute=await authMock(state,name);
  await context.route('**/*',async route=>{
    try{
      const url=new URL(route.request().url());
      if(![shop,auth].includes(url.origin)){state.blocked++;await route.abort('blockedbyclient');return;}
      if(url.origin===auth){await authRoute(route,url);return;}
      if(url.pathname.startsWith('/api/')){await api(route,url,state,scenario);return;}
      await route.continue();
    }catch(error){
      state.violations++;await writeFile(`/state/${name}-diagnostic.txt`,String(error.stack),{mode:0o600});
      await route.abort('blockedbyclient').catch(()=>{});
    }
  });
}
