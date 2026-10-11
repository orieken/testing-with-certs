import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { validateHttpResponse } from '../../api/contracts/validator.ts';
const base='http://reporting-mock:8081/internal/reporting/orders?limit=100&from=2026-09-01T00%3A00%3A00Z&to=2026-10-01T00%3A00%3A00Z';
async function page(mode,index){const response=await fetch(`${base}&mode=${mode}&generation=${mode}`,{signal:AbortSignal.timeout(5000)});const rawBody=Buffer.from(await response.arrayBuffer());return {status:response.status,headers:Object.fromEntries(response.headers),rawBody,body:JSON.parse(rawBody)};}
const results=[];
for(const mode of ['healthy','conflict','revision','outage','repeat','empty','wrong-type']){
 for(let index=1;index<=2;index++){
  const value=await page(mode,index);const expected=index===2?({conflict:409,outage:503}[mode]??200):200;assert.equal(value.status,expected);
  if(mode==='wrong-type')assert.throws(()=>validateHttpResponse('customer','listReportingOrders',200,value),/violates expected OpenAPI/);
  else validateHttpResponse('customer','listReportingOrders',expected,value);
  if(mode==='revision'&&index===2)assert.equal(value.body.revision,'r2');
  results.push({mode,index,status:expected,ajvValid:mode!=='wrong-type'});
 }
}
writeFileSync('/reports/compatibility.json',JSON.stringify({source:'mokapi-script-compatibility',version:'0.52.0',digest:'sha256:ba936c3c88db3f95674cbb7b7c790193de1a7e5b6f638efa6adcb89fc6f19be8',results,decision:'isolated sequences behind verified TLS/real-authorization wrapper; not a real provider'},null,2));
console.log('PASS: 14 Mokapi scripted page observations, valid responses checked by Ajv and intentional invalid response rejected');
