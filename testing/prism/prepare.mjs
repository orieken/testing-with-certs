import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { validateHttpResponse, validateJsonRequest } from '/work/testing/api/contracts/validator.ts';
import { fixtures, populated, item, regions, sales, checkout, FAULT_wrong_type, FAULT_tuple, FAULT_date, FAULT_json, FAULT_oversized, FAULT_tuple_position, FAULT_tuple_type, FAULT_date_calendar } from './fixtures.mjs';
const response = (status, body, headers = {}) => ({ status, headers: body === undefined ? headers : { 'content-type':'application/json', ...headers }, rawBody: body === undefined ? Buffer.alloc(0) : Buffer.from(JSON.stringify(body)) });
validateJsonRequest('customer','createOrder',checkout);
for (const [service,op,status,_name,body,headers] of fixtures) validateHttpResponse(service,op,status,response(status,body,headers));
for (const [service,op,body] of [['catalog','listItems',FAULT_wrong_type],['insights','listRegions',FAULT_tuple],['insights','getSalesSummary',FAULT_date],['insights','listRegions',FAULT_tuple_position],['insights','listRegions',FAULT_tuple_type],['insights','getSalesSummary',FAULT_date_calendar]]) assert.throws(() => validateHttpResponse(service,op,200,response(200,body)), /violates expected OpenAPI/);
assert.throws(() => validateHttpResponse('customer','createOrder',201,{status:201,headers:{'content-type':'application/json',location:'/api/customer/orders/fault'},rawBody:Buffer.from(FAULT_json)}),/invalid JSON/);
assert.ok(Buffer.byteLength(FAULT_oversized)>1_048_576);assert.equal(JSON.parse(FAULT_oversized).orderId,'order-mock-1');
assert.throws(() => validateHttpResponse('customer','createOrder',201,{status:201,headers:{'content-type':'application/json',location:'/api/customer/orders/fault'},rawBody:Buffer.from(FAULT_oversized)}),/exceeds 1 MB/);
for (const service of ['catalog','customer','insights']) {
  const doc = JSON.parse(readFileSync(`/work/contracts/bundled/${service}.json`));
  // Only the disposable mock derivative removes security metadata. Schema/path/parameters remain canonical.
  doc.security = []; delete doc.components.securitySchemes;
  for (const path of Object.values(doc.paths)) for (const operation of Object.values(path)) if(operation.operationId) operation.security=[];
  for (const [,op,status,name,body,headers] of fixtures.filter(value => value[0]===service)) {
    const operation = Object.values(doc.paths).flatMap(Object.values).find(value => value.operationId===op);
    if(body!==undefined) { const media=operation.responses[status].content['application/json']; media.examples??={}; media.examples[name]={value:body}; }
    if(headers?.location) operation.responses[status].headers.Location.example=headers.location;
  }
  writeFileSync(`/fixtures/${service}.json`,JSON.stringify(doc));
}
writeFileSync('/fixtures/data.json',JSON.stringify({populated,item,regions,sales,FAULT_wrong_type,FAULT_tuple,FAULT_date,FAULT_tuple_position,FAULT_tuple_type,FAULT_date_calendar}));
writeFileSync('/fixtures/control.json',JSON.stringify({mode:'healthy'}));
console.log(`PASS: ${fixtures.length} canonical response fixtures and checkout request checked by Ajv; labelled invalid type/tuple/date/JSON/size faults checked; read-only mock derivatives ready`);
