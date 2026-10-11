import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { request as httpsRequest } from 'node:https';
import { createRequire } from 'node:module';
import { validateHttpResponse } from '/work/testing/api/contracts/validator.ts';
import { mockRequest } from '../request.mjs';
import { populated, empty, item, errors, regions, sales } from '../fixtures.mjs';
const {expect}=createRequire('/work/testing/package.json')('@playwright/test');
const results=[];
function mode(value){writeFileSync('/fixtures/control.next',JSON.stringify({mode:value}));renameSync('/fixtures/control.next','/fixtures/control.json');}
function record(name,detail){results.push({name,...detail});console.log(`OBSERVED: ${name}: ${JSON.stringify(detail)}`);}
function ajv(service,op,status,response){try{validateHttpResponse(service,op,status,response);return true;}catch{return false;}}
const bodyOf=response=>JSON.parse(response.rawBody);
await expect.poll(async()=>{try{return(await mockRequest('/ready')).status;}catch{return 0;}},{timeout:15000,intervals:[100,250,500]}).toBe(200);
for(const [name,path,service,op,status,example,expected,method,body] of [
 ['populated','/api/catalog/items','catalog','listItems',200,'populated',populated],
 ['empty','/api/catalog/items','catalog','listItems',200,'empty',empty],
 ['geo2020-valid','/api/insights/regions','insights','listRegions',200,'regions',regions],
 ['salesUTC-valid','/api/insights/sales?from=2026-09-01T00%3A00%3A00Z&to=2026-10-01T00%3A00%3A00Z','insights','getSalesSummary',200,'sales',sales],
 ['structured-403','/api/catalog/items','catalog','listItems',403,'forbidden',errors[403]],
 ['created-location','/api/catalog/items','catalog','createItem',201,'created',item,'POST',{...item,id:undefined,active:undefined}],
 ['bodyless-204',`/api/catalog/items/${item.id}`,'catalog','archiveItem',204,null,null,'DELETE'],
 ...[409,422,503].map(status=>[`checkout-${status}`,'/api/customer/orders','customer','createOrder',status,`error${status}`,errors[status],'POST',{regionId:'waterdeep',lines:[{itemId:item.id,quantity:1}]}])
]){
 const response=await mockRequest(path,{method,body,prefer:`code=${status}${example?`, example=${example}`:''}`});
 validateHttpResponse(service,op,status,response);if(expected)assert.deepEqual(bodyOf(response),expected);else assert.equal(response.rawBody.length,0);
 record(name,{status:response.status,ajv:true,requiredHeaderPresent:status===201?Boolean(response.headers.location):null});
}
const invalid=await mockRequest('/api/catalog/items?limit=0');assert.equal(invalid.status,400);validateHttpResponse('catalog','listItems',400,invalid);record('invalid-query',{status:invalid.status,ajv:true});
for(const [name,selected,path,method,body] of [
 ['wrong-type-warning','proxy-report','/api/catalog/items'],['wrong-type-enforced','proxy-errors','/api/catalog/items'],
 ['tuple-enforced','proxy-insights','/api/insights/regions'], ['tuple-position-enforced','proxy-insights','/api/insights/regions'], ['tuple-type-enforced','proxy-insights','/api/insights/regions'],['date-enforced','proxy-insights','/api/insights/sales?from=2026-09-01T00%3A00%3A00Z&to=2026-10-01T00%3A00%3A00Z'],
 ['date-calendar-enforced','proxy-insights','/api/insights/sales?from=2026-09-01T00%3A00%3A00Z&to=2026-10-01T00%3A00%3A00Z'],
 ['location-enforced','proxy-errors','/api/catalog/items','POST',{name:'Mock',description:'Example',rarity:'Common',image:'/images/wand-embers.png',priceCopper:100}]
]){
 mode(name.startsWith('tuple-position')?'tuple-position':name.startsWith('tuple-type')?'tuple-type':name.startsWith('date-calendar')?'date-calendar':name.startsWith('tuple')?'tuple-invalid':name.startsWith('date')?'date-invalid':name.startsWith('location')?'missing-location':'wrong-type');
 const response=await mockRequest(path,{proxy:selected,method,body});
 const service=name.startsWith('tuple')||name.startsWith('date')?'insights':'catalog';
 const op=name.startsWith('tuple')?'listRegions':name.startsWith('date')?'getSalesSummary':name.startsWith('location')?'createItem':'listItems';
 const expectedStatus=name.startsWith('location')?201:200;
 const details=JSON.parse(response.headers['sl-violations']??'[]').map(value=>({location:value.location,code:value.code,message:value.message}));
 const violations=details.some(value=>value.location?.[0]==='response');
 record(name,{status:response.status,ajvAcceptsOriginal:ajv(service,op,expectedStatus,response),violationHeader:violations,validation:details,rejectsInvalid:response.status>=400,supported:name.endsWith('warning')?response.status===200&&violations:response.status>=400&&violations});
}
mode('healthy');
const beforeInvalid=JSON.parse(readFileSync('/fixtures/audit.json')).requests;
const requestFailure=await mockRequest('/api/catalog/items',{proxy:'proxy-errors',method:'POST',body:{name:'Invalid',priceCopper:'WRONG_TYPE'}});
const afterInvalid=JSON.parse(readFileSync('/fixtures/audit.json')).requests;
record('invalid-request-enforced',{status:requestFailure.status,rejectsInvalid:requestFailure.status>=400,upstreamCalls:afterInvalid-beforeInvalid,supported:requestFailure.status>=400&&afterInvalid===beforeInvalid});
mode('501');const fallback=await mockRequest('/api/catalog/items',{proxy:'proxy-errors',prefer:'code=200, example=empty'});
record('upstream-501',{upstreamStatus:501,status:fallback.status,canonicalMockFallback:ajv('catalog','listItems',200,fallback)&&JSON.stringify(bodyOf(fallback))===JSON.stringify(empty)});
mode('healthy');
for(const proxy of ['proxy-tls','proxy-bad-ca','proxy-bad-name','proxy-mtls']){
 const before=JSON.parse(readFileSync('/fixtures/audit.json')).requests;
 const response=await mockRequest('/api/catalog/items',{proxy});
 const after=JSON.parse(readFileSync('/fixtures/audit.json')).requests;
 record(proxy,{status:response.status,upstreamCalls:after-before,canonicalSuccess:ajv('catalog','listItems',200,response),supported:proxy==='proxy-tls'?response.status===200:response.status>=400&&after===before});
}
const ca=readFileSync('/public/server-ca.pem');
function direct(options={}){return new Promise((resolve,reject)=>{const req=httpsRequest('https://upstream:8445/api/catalog/items',{ca,cert:readFileSync('/identity/cert.pem'),key:readFileSync('/identity/key.pem'),rejectUnauthorized:true,signal:AbortSignal.timeout(5000),...options},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end();});}
assert.equal(await direct(),200);await assert.rejects(direct({cert:undefined,key:undefined}));
await assert.rejects(mockRequest('/ready',{options:{ca:readFileSync('/public/client-ca.pem')}}));
await assert.rejects(mockRequest('/ready',{options:{servername:'wrong.invalid'}}));
await assert.rejects(mockRequest('/ready',{options:{cert:undefined,key:undefined}}));
record('tls-controls',{verifiedFrontTls:true,missingFrontClientRejected:true,wrongFrontCaRejected:true,wrongFrontHostnameRejected:true,directUpstreamMutualTls:true,missingUpstreamClientRejected:true,prismClientCertificateForwarding:results.find(result=>result.name==='proxy-mtls').canonicalSuccess});
const stripped=await mockRequest('/api/catalog/items',{options:{headers:{authorization:'Bearer synthetic-marker',cookie:'synthetic=safe','x-compat-proxy':'proxy-report'}}});
assert.equal(stripped.status,200);const audit=JSON.parse(readFileSync('/fixtures/audit.json'));
assert.equal(audit.authorizationSeen,false);assert.equal(audit.cookieSeen,false);
record('credential-strip',{syntheticBearerStripped:true,cookieStripped:true});
assert.equal(results.length,27);
const report={schemaVersion:1,source:'prism-compatibility-experiment',prism:'5.14.2',digest:'sha256:87972b6cf73da2c0339fca18f362b6f93118152d652c970fab93ed13cfd55bae',decision:'mock-only; no authenticated proxy routing',specDigests:JSON.parse(readFileSync('/work/contracts/bundled/digests.json')).services,results};
writeFileSync('/reports/compatibility.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS: bounded Prism compatibility experiment recorded; mock-only decision, no real-provider evidence');
