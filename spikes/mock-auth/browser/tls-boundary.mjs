import https from 'node:https';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ca=readFileSync('/public/server-ca.pem'),cert=readFileSync('/identity/cert.pem'),key=readFileSync('/identity/key.pem');
const probe=options=>new Promise((resolve,reject)=>{const req=https.get('https://shop.magic.test:8443/harness-audit',{ca,cert,key,...options},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.setTimeout(5000,()=>req.destroy(new Error('Bounded TLS probe timeout')));req.on('error',reject);});
for(let i=0;;i++){try{assert.equal(await probe({}),200);break;}catch(e){if(i===15)throw e;await new Promise(r=>setTimeout(r,500));}}
await assert.rejects(probe({cert:undefined,key:undefined}));
await assert.rejects(probe({ca:readFileSync('/public/client-ca.pem')}));
await assert.rejects(probe({servername:'wrong.invalid'}));
console.log('TLS boundary: trusted client accepted; missing certificate, wrong CA and wrong hostname rejected.');
