import assert from 'node:assert/strict';
import { request } from 'node:https';
import { readFileSync, writeFileSync } from 'node:fs';
import { mockRequest } from './request.mjs';
import { createRequire } from 'node:module';
const {expect}=createRequire('/work/testing/package.json')('@playwright/test');
const ca=readFileSync('/public/server-ca.pem'),cert=readFileSync('/identity/cert.pem'),key=readFileSync('/identity/key.pem');
function probe(options={}){return new Promise((resolve,reject)=>{const req=request('https://shop.magic.test:8443/harness-audit',{ca,cert,key,rejectUnauthorized:true,signal:AbortSignal.timeout(5000),...options},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end();});}
await expect.poll(async()=>{try{return await probe();}catch{return 0;}},{timeout:15000,intervals:[100,250,500]}).toBe(200);
await assert.rejects(probe({cert:undefined,key:undefined}));await assert.rejects(probe({ca:readFileSync('/public/client-ca.pem')}));await assert.rejects(probe({servername:'wrong.invalid'}));
assert.equal((await mockRequest('/ready')).status,200);
await assert.rejects(mockRequest('/ready',{options:{cert:undefined,key:undefined}}));
await assert.rejects(mockRequest('/ready',{options:{ca:readFileSync('/public/client-ca.pem')}}));
await assert.rejects(mockRequest('/ready',{options:{servername:'wrong.invalid'}}));
writeFileSync('/reports/tls-boundary.json',JSON.stringify({source:'prism-mock-browser-boundary',verifiedUiTls:true,verifiedAdapterTls:true,missingClientRejected:true,wrongCaRejected:true,wrongHostnameRejected:true,realCertificatePairing:false},null,2)+'\n');
console.log('PASS: synthetic UI and mock-adapter TLS/mTLS boundaries reject absent clients and wrong CA/hostname');
