import assert from 'node:assert/strict';
import { test, request } from '@playwright/test';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { request as https } from 'node:https';
import { userToken } from '../../api/contracts/user-token.ts';
import { validatePlaywrightResponse, validateHttpResponse } from '../../api/contracts/validator.ts';
const shop='https://shop.magic.test:8443';
let admin;
function select(mode){const generation=randomUUID();writeFileSync('/fault-state/control.next',JSON.stringify({mode,generation}));renameSync('/fault-state/control.next','/fault-state/control.json');return generation;}
function audit(){return JSON.parse(readFileSync('/fault-state/audit.json'));}
function evidence(value){test.info().annotations.push({type:'reporting-fault',description:JSON.stringify(value)});}
const dates='from=2026-09-01T00%3A00%3A00Z&to=2026-10-01T00%3A00%3A00Z';
const operations={sales:'getSalesSummary',customers:'listRegionalCustomers',orders:'listRegionalOrders'};
test.beforeAll(async()=>{const certificate={certificatePath:'/identity-admin/cert.pem',privateKeyPath:'/identity-admin/key.pem'};admin=await request.newContext({baseURL:shop,ignoreHTTPSErrors:false,timeout:15000,clientCertificates:[{origin:shop,certPath:certificate.certificatePath,keyPath:certificate.privateKeyPath}],extraHTTPHeaders:{Authorization:`Bearer ${await userToken(certificate)}`}});});
test.afterAll(async()=>{select('healthy');await admin?.dispose();});
async function read(kind,status){const res=await admin.get(`/api/insights/${kind}?${dates}&regionId=waterdeep`);await validatePlaywrightResponse('insights',operations[kind],status,res);return res.json();}
function summary(body,kind,count){if(kind==='sales'){assert.equal(body.orderCount,count);assert.equal(body.salesCopper,count*100);assert.equal(body.customerCount,count?1:0);}else{assert.equal(body.items.length,kind==='customers'?1:count);if(kind==='customers'){assert.equal(body.items[0].orderCount,count);assert.equal(body.items[0].salesCopper,count*100);}}}
for(const kind of Object.keys(operations))for(const [mode,status,calls] of [['conflict',409,2],['revision',409,2],['outage',503,2],['repeat',503,2]]){
 test(`TEST-09 ${kind} ${mode}: no partial aggregate; explicit recovery`,async()=>{
  const generation=select(mode);const start=performance.now();const body=await read(kind,status);
  assert.deepEqual(body,{code:status===409?'conflict':'dependency_unavailable',message:status===409?'conflict':'dependency_unavailable'});
  const elapsedMs=Math.round(performance.now()-start);assert.ok(elapsedMs<10000);assert.deepEqual(audit(),{generation,calls,authorized:calls,rejected:0});
  select('healthy');summary(await read(kind,200),kind,2);assert.equal(audit().calls,2);
  evidence({mode,kind,status,calls,elapsedMs,boundMs:10000,recovery:200,partial:false,upstreamAuthorization:true});
 });
}
for(const kind of Object.keys(operations))test(`TEST-09 ${kind} empty intermediate page continues`,async()=>{select('empty');summary(await read(kind,200),kind,2);assert.equal(audit().calls,3);evidence({mode:'empty',kind,status:200,calls:3,partial:false});});
for(const [mode,status,calls]of [['exact',200,100],['over',503,101],['loop',503,101]])test(`TEST-09 sales ${mode} record/page bound`,async()=>{select(mode);const start=performance.now();const body=await read('sales',status);if(status===200)summary(body,'sales',10000);else assert.deepEqual(body,{code:'dependency_unavailable',message:'dependency_unavailable'});assert.equal(audit().calls,calls);const elapsedMs=Math.round(performance.now()-start);assert.ok(elapsedMs<30000);select('healthy');summary(await read('sales',200),'sales',2);evidence({mode,kind:'sales',status,calls,elapsedMs,boundMs:30000,recovery:200,partial:false});});
function probe({ca=readFileSync('/public/server-ca.pem'),servername='customer-api',identity='/service-identity',token='' }={}){return new Promise((resolve,reject)=>{const req=https({host:process.env.REPORTING_FAULT_IP,port:8443,servername,ca,rejectUnauthorized:true,agent:false,signal:AbortSignal.timeout(5000),path:`/internal/reporting/orders?limit=100&${dates}`,headers:{authorization:token},...(identity?{cert:readFileSync(`${identity}/cert.pem`),key:readFileSync(`${identity}/key.pem`)}:{})},res=>{const chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,rawBody:Buffer.concat(chunks)}));res.on('error',reject);});req.on('error',reject);req.end();});}
async function reportingToken(){const context=await request.newContext({ignoreHTTPSErrors:false,timeout:10000});try{const res=await context.post('https://auth.magic.test:9443/realms/magic-shop/protocol/openid-connect/token',{form:{grant_type:'client_credentials',client_id:'insights-reporting',client_secret:readFileSync('/reporting-secret/client-secret','utf8').trim(),scope:'reporting.read'}});assert.equal(res.status(),200);return 'Bearer '+(await res.json()).access_token;}finally{await context.dispose();}}
test('TEST-06 verified TLS, real authorization and explicit invalid schema fault',async()=>{
 await assert.rejects(probe({identity:null}));await assert.rejects(probe({ca:readFileSync('/public/user-ca.pem')}));await assert.rejects(probe({servername:'wrong.magic.test'}));
 await assert.rejects(probe({identity:'/identity-customer'}));assert.equal((await probe({identity:'/wrong-service-identity'})).status,403);assert.equal((await probe()).status,401);
 const token=await reportingToken();select('healthy');const valid=await probe({token});validateHttpResponse('customer','listReportingOrders',200,valid);
 select('wrong-type');const bad=await probe({token});assert.equal(bad.status,200);assert.throws(()=>validateHttpResponse('customer','listReportingOrders',200,bad),/violates expected OpenAPI/);
 select('healthy');validateHttpResponse('customer','listReportingOrders',200,await probe({token}));
 evidence({mode:'tls-schema',kind:'boundary',status:200,verifiedTls:true,negativeTls:4,authorizationNegatives:2,invalidFixtureRejectedByAjv:true,mokapiDoesNotEnforceScriptResponse:true});
});
