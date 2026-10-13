import assert from 'node:assert/strict';
import { request,test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { context } from './context.mjs';
import { from,to,ownerA,ownerB,oracle,includedIds } from './fixtures.mjs';
import { validatePlaywrightResponse } from '../api/contracts/validator.ts';
import { pool,snapshot } from './database.mjs';
import { ServiceTokenClient } from 'saturday-keycloak-prototype';
let admin;test.beforeAll(async()=>{admin=await context('identity-admin');});test.afterAll(async()=>{await admin?.dispose();await pool.end();});
function note(mode,extra={}){test.info().annotations.push({type:'regional',description:JSON.stringify({mode,...extra})});}
async function read(kind,query){const response=await admin.get(`/api/insights/${kind}?${query}`);await validatePlaywrightResponse('insights',{sales:'getSalesSummary',orders:'listRegionalOrders',customers:'listRegionalCustomers'}[kind],200,response);return response.json();}
const period=new URLSearchParams({from,to,regionId:'waterdeep'});
async function all(kind,limit){const items=[];const cursors=new Set();let cursor=null,pages=0;do{const q=new URLSearchParams(period);q.set('limit',String(limit));if(cursor)q.set('cursor',cursor);const page=await read(kind,q);items.push(...page.items);cursor=page.nextCursor;pages++;assert.ok(pages<=10);if(cursor){assert.ok(!cursors.has(cursor));cursors.add(cursor);}}while(cursor);return {items,pages};}
test('TEST-10 exact UTC inclusion/exclusion and completed-only aggregate',async()=>{
 const sales=await read('sales',period);assert.deepEqual([sales.orderCount,sales.customerCount,sales.salesCopper],[110,2,11100]);
 const rows=await snapshot();assert.equal(rows.length,114);assert.equal(rows.filter(r=>r.status!=='completed').length,2);
 const lower=await read('sales',new URLSearchParams({from,to:'2026-11-01T00:00:01Z',regionId:'waterdeep'}));assert.deepEqual([lower.orderCount,lower.salesCopper],[1,100]);
 const upper=await read('sales',new URLSearchParams({from:'2026-11-30T23:59:59Z',to,regionId:'waterdeep'}));assert.deepEqual([upper.orderCount,upper.salesCopper],[1,200]);
 const adjacent=await read('sales',new URLSearchParams({from:to,to:'2026-12-01T00:00:01Z',regionId:'waterdeep'}));assert.deepEqual([adjacent.orderCount,adjacent.salesCopper],[1,300]);note('utc-boundaries',{orderCount:110,salesCopper:11100});
});
test('TEST-10 historical order region survives real profile move',async()=>{
 const profile=await admin.get('/api/customer/admin/users?regionId=baldurs-gate');await validatePlaywrightResponse('customer','listAdminUsers',200,profile);const a=(await profile.json()).items.find(r=>r.sub===ownerA);assert.equal(a.regionId,'baldurs-gate');assert.deepEqual(a.location,[-119.5,42]);
 const waterdeep=await read('sales',period);assert.equal(waterdeep.salesCopper,11100);const movedRegion=await read('sales',new URLSearchParams({from,to,regionId:'baldurs-gate'}));assert.equal(movedRegion.salesCopper,0);
 const {items,pages}=await all('customers',1);assert.equal(pages,2);assert.deepEqual(items.map(r=>({sub:r.sub,orderCount:r.orderCount,salesCopper:r.salesCopper})),[{sub:ownerA,...oracle.customerA},{sub:ownerB,...oracle.customerB}]);note('moved-profile',{historicalRegion:'waterdeep',currentRegion:'baldurs-gate',pages:2});
});
test('TEST-10 complete totals and identities across real provider pages',async()=>{const {items,pages}=await all('orders',17);assert.equal(pages,7);assert.deepEqual(items.map(r=>r.orderId),includedIds);assert.equal(new Set(items.map(r=>r.orderId)).size,110);assert.equal(items.reduce((total,r)=>total+r.totalCopper,0),11100);note('pagination',{pages,orderCount:110,salesCopper:11100});});
test('TEST-10 preserve September oracle and empty region',async()=>{const seed=JSON.parse(readFileSync('/work/seed/reporting-oracle.json'));const sales=await read('sales',new URLSearchParams({from:'2026-09-01T00:00:00Z',to:'2026-10-01T00:00:00Z'}));assert.deepEqual([sales.orderCount,sales.customerCount,sales.salesCopper],[seed.overall.orderCount,seed.overall.customerCount,seed.overall.salesCopper]);assert.deepEqual(sales.regions.map(r=>[r.regionId,r.orderCount,r.customerCount,r.salesCopper]),seed.regions.map(r=>[r.regionId,r.orderCount,r.customerCount,r.salesCopper]));const empty=await read('sales',new URLSearchParams({from,to,regionId:'empty-march'}));assert.deepEqual([empty.orderCount,empty.customerCount,empty.salesCopper],[0,0,0]);assert.deepEqual((await read('orders',new URLSearchParams({from,to,regionId:'empty-march'}))).items,[]);note('seed-empty',{septemberCopper:124000,emptyCopper:0});});

 test('TEST-10 real reporting feed uses two revision-pinned pages',async()=>{
 const issuer='https://auth.magic.test:9443/realms/magic-shop';
 const token=await new ServiceTokenClient({target:{issuer,origins:['https://auth.magic.test:9443']},clientId:'insights-reporting',secretFile:'/reporting-secret/client-secret',audience:'customer-api',scopes:['reporting.read']}).getToken();
 const consumer=await request.newContext({baseURL:'https://customer-api:8443',ignoreHTTPSErrors:false,clientCertificates:[{origin:'https://customer-api:8443',certPath:'/reporting-identity/cert.pem',keyPath:'/reporting-identity/key.pem'}],extraHTTPHeaders:{Authorization:`Bearer ${token}`},timeout:10000});
 try{const q=new URLSearchParams(period);q.set('limit','100');const first=await consumer.get('/internal/reporting/orders?'+q);await validatePlaywrightResponse('customer','listReportingOrders',200,first);const a=await first.json();assert.equal(a.items.length,100);assert.ok(a.nextCursor);q.set('cursor',a.nextCursor);q.set('revision',a.revision);const second=await consumer.get('/internal/reporting/orders?'+q);await validatePlaywrightResponse('customer','listReportingOrders',200,second);const b=await second.json();assert.equal(b.items.length,10);assert.equal(b.nextCursor,null);assert.equal(b.revision,a.revision);assert.deepEqual([...a.items,...b.items].map(r=>r.order.orderId),includedIds);assert.equal([...a.items,...b.items].find(r=>r.order.ownerSub===ownerA).customer.regionId,'baldurs-gate');note('reporting-feed',{pages:2,orderCount:110,revisionPinned:true});}finally{await consumer.dispose();}
 });

test('TEST-10 observed mixed-precision timestamp limitation (no app change)',async()=>{const q=new URLSearchParams({from,to:'2026-11-01T00:00:00.001Z',regionId:'waterdeep'});const response=await admin.get('/api/insights/sales?'+q);await validatePlaywrightResponse('insights','getSalesSummary',503,response);assert.deepEqual(await response.json(),{code:'dependency_unavailable',message:'dependency_unavailable'});note('mixed-precision-limitation',{status:503,supported:false});});
