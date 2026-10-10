import https from 'node:https';
import { readFileSync } from 'node:fs';
export function request(url, {method='GET', headers={}, body, timeout=2000, ca=readFileSync('/trust/ca.pem'), servername} = {}) {
  return new Promise((resolve,reject)=>{
    const req = https.request(url,{method,headers,ca,servername,rejectUnauthorized:true},res=>{
      const chunks=[]; let size=0;
      res.on('data',chunk=>{size+=chunk.length; if(size>1_000_000) req.destroy(new Error('size limit')); else chunks.push(chunk);});
      res.on('error',reject);
      res.on('aborted',()=>reject(new Error('response aborted')));
      res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,rawBody:Buffer.concat(chunks)}));
    });
    const timer=setTimeout(()=>req.destroy(new Error('deadline exceeded')),timeout);
    req.on('close',()=>clearTimeout(timer)); req.on('error',reject);
    req.end(body);
  });
}
export const json = response => JSON.parse(response.rawBody.toString());
export async function ready(url) {
  for(let n=0;n<60;n++) {
    try { if((await request(url)).status===200) return; } catch {}
    await new Promise(r=>setTimeout(r,500));
  }
  throw new Error('mock readiness deadline');
}
