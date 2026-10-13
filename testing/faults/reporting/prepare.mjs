import { readFileSync, writeFileSync } from 'node:fs';
import { validateHttpResponse } from '../../api/contracts/validator.ts';
const canonical=JSON.parse(readFileSync('/work/contracts/bundled/customer.json'));
const profile={sub:'00000000-0000-4000-8000-000000000001',displayName:'Reporting Fixture',regionId:'waterdeep',location:[-120,45]};
function row(index){return {customer:profile,order:{orderId:`report-${index}`,ownerSub:profile.sub,regionId:'waterdeep',status:'completed',createdAt:'2026-09-10T00:00:00Z',completedAt:'2026-09-10T00:00:00Z',lines:[{itemId:'wand-embers',name:'Wand',unitPriceCopper:100,quantity:1,lineTotalCopper:100}],totalCopper:100}};}
for(const body of [{revision:'r1',items:[row(1)],nextCursor:'c1'},{revision:'r1',items:[],nextCursor:'c2'},{revision:'r1',items:Array.from({length:100},(_,i)=>row(i)),nextCursor:null}])validateHttpResponse('customer','listReportingOrders',200,{status:200,headers:{'content-type':'application/json'},rawBody:Buffer.from(JSON.stringify(body))});
const operation=structuredClone(canonical.paths['/internal/reporting/orders'].get);delete operation.security;delete operation['x-auth'];
operation.responses['200'].content['application/json'].example={revision:'r1',items:[],nextCursor:null};
operation.parameters.push(...['mode','generation'].map(name=>({name,in:'query',required:true,schema:{type:'string'}})));
const spec={...canonical,info:{...canonical.info,title:'Isolated Mokapi reporting sequences'},servers:[{url:'http://reporting-mock:8081'}],paths:{'/internal/reporting/orders':{get:operation}}};delete spec.security;
writeFileSync('/fault-state/mock.json',JSON.stringify(spec));
writeFileSync('/fault-state/sequence.js',`import { on } from 'mokapi';\nconst customer=${JSON.stringify(profile)};\n${row.toString().replaceAll('profile','customer')}\n`+readFileSync('/work/testing/faults/reporting/sequence.txt','utf8'));
writeFileSync('/fault-state/control.json',JSON.stringify({mode:'healthy',generation:'initial'}));
console.log('Canonical reporting pages checked with existing Ajv; read-only bundle derivative written to volume');
