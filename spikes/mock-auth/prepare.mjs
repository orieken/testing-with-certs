import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { validateHttpResponse } from '/work/testing/api/contracts/validator.ts';
const f=JSON.parse(readFileSync('/work/spikes/mock-auth/fixtures.json'));
const response=(status,body,headers={'content-type':'application/json'})=>({status,headers,rawBody:body===undefined?Buffer.alloc(0):Buffer.from(JSON.stringify(body))});
for(const name of ['populated','empty']) validateHttpResponse('catalog','listItems',200,response(200,f[name]));
validateHttpResponse('catalog','listItems',403,response(403,f.forbidden));
validateHttpResponse('catalog','listItems',400,response(400,f.invalidRequest));
validateHttpResponse('catalog','getItem',404,response(404,f.notFound));
validateHttpResponse('catalog','createItem',201,response(201,f.populated.items[0],{'content-type':'application/json',location:'/api/catalog/items/potion-healing'}));
validateHttpResponse('catalog','archiveItem',204,response(204));
assert.throws(()=>validateHttpResponse('catalog','listItems',200,response(200,f.FAULT_wrong_type)),/integer/);
const contract=JSON.parse(readFileSync('/work/contracts/bundled/catalog.json'));
// Mock-only derivative. Original security semantics remain in the read-only source.
contract.security=[]; delete contract.components.securitySchemes;
for(const path of Object.values(contract.paths)) for(const op of Object.values(path)) if(op.operationId) op.security=[];
const add=(path,method,status,name,value)=>{
  const media=contract.paths[path][method].responses[status].content['application/json'];
  media.examples??={}; media.examples[name]={value};
};
add('/api/catalog/items','get','200','populated',f.populated);
add('/api/catalog/items','get','200','empty',f.empty);
add('/api/catalog/items','get','400','invalidRequest',f.invalidRequest);
add('/api/catalog/items','get','403','forbidden',f.forbidden);
add('/api/catalog/items/{itemId}','get','404','notFound',f.notFound);
add('/api/catalog/items','post','201','created',f.populated.items[0]);
contract.paths['/api/catalog/items'].post.responses['201'].headers.Location.example='/api/catalog/items/potion-healing';
writeFileSync('/fixtures/catalog.json',JSON.stringify(contract));
console.log('Ajv 8.20.0: 7 normal fixtures accepted; labelled FAULT_wrong_type rejected; canonical-derived Prism input prepared');
