import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { request, json, ready } from './http.mjs';
import { validateHttpResponse, validateJsonRequest } from '/work/testing/api/contracts/validator.ts';
const origin='https://api:8443';
// A standalone consumer: invalid/error responses clear prior success and do not auto-retry writes.
export class CatalogConsumer {
  value=null;
  async load(example='populated',scenario,status=200) {
    this.value=null;
    const response=await request(`${origin}/api/catalog/items`,{headers:{prefer:`code=${status}, example=${example}`,...(scenario?{'x-test-scenario':scenario}:{})},timeout:250});
    validateHttpResponse('catalog','listItems',status,response);
    if(status!==200) {const error=new Error(json(response).message);error.code=json(response).code;throw error;}
    this.value=json(response);return this.value;
  }
}
export async function runApi() {
  await ready(`${origin}/ready`);
  // Bounded Prism readiness, independent of TLS adapter readiness.
  for(let n=0;n<40;n++) {try{if((await request(`${origin}/api/catalog/items`)).status===200)break;}catch{} if(n===39)throw new Error('Prism readiness deadline');await new Promise(r=>setTimeout(r,250));}
  const fixture=JSON.parse(readFileSync('/work/spikes/mock-auth/fixtures.json'));
  const consumer=new CatalogConsumer();
  assert.deepEqual(await consumer.load(),fixture.populated);
  assert.deepEqual(await consumer.load('empty'),fixture.empty);
  for(const [status,name] of [[400,'invalidRequest'],[403,'forbidden']]) {
    await consumer.load();
    await assert.rejects(()=>consumer.load(name,undefined,status),error=>error.code===fixture[name].code && error.message===fixture[name].message);
    assert.equal(consumer.value,null);
    assert.deepEqual(await consumer.load(),fixture.populated);
  }
  const missing=await request(`${origin}/api/catalog/items/missing`,{headers:{prefer:'code=404, example=notFound'}});
  validateHttpResponse('catalog','getItem',404,missing);assert.deepEqual(json(missing),fixture.notFound);
  const invalid=await request(`${origin}/api/catalog/items?limit=0`);
  assert.equal(invalid.status,400);validateHttpResponse('catalog','listItems',400,invalid);
  const item=fixture.populated.items[0];const {id,active,...input}=item;
  validateJsonRequest('catalog','createItem',input);
  const created=await request(`${origin}/api/catalog/items`,{method:'POST',headers:{'content-type':'application/json',prefer:'code=201, example=created'},body:JSON.stringify(input)});
  validateHttpResponse('catalog','createItem',201,created);assert.deepEqual(json(created),item);
  const deleted=await request(`${origin}/api/catalog/items/potion-healing`,{method:'DELETE',headers:{prefer:'code=204'}});
  validateHttpResponse('catalog','archiveItem',204,deleted);
  await consumer.load(); const start=performance.now();
  await assert.rejects(()=>consumer.load('populated','delay'),/deadline exceeded/);
  const elapsed=Math.round(performance.now()-start);assert.ok(elapsed>=200 && elapsed<1500);assert.equal(consumer.value,null);
  assert.deepEqual(await consumer.load(),fixture.populated);
  await assert.rejects(()=>consumer.load('populated','FAULT_wrong_type'),/integer/);assert.equal(consumer.value,null);
  assert.deepEqual(await consumer.load(),fixture.populated);
  await assert.rejects(()=>request(`${origin}/ready`,{ca:[]}),/certificate|issuer|self-signed/i);
  await assert.rejects(()=>request(`${origin}/ready`,{servername:'wrong.test'}),/Hostname|altnames/i);
  console.log(`MOCK-CONSUMER FEATURE-03: Prism examples/errors/request rejection/201 header/204 passed; delay rejected at ${elapsed}ms; fault rejected; recovery passed`);
}
