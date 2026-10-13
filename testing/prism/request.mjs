import { request } from 'node:https';
import { readFileSync } from 'node:fs';
export function mockRequest(path, { method='GET', body, prefer='code=200, example=populated', proxy, idempotencyKey='compatibility-fixture-key', options={} } = {}) {
  const data=body===undefined?undefined:Buffer.from(JSON.stringify(body));
  return new Promise((resolve,reject)=>{
    const req=request(`https://mock-api:8443${path}`,{ca:readFileSync('/public/server-ca.pem'),cert:readFileSync('/identity/cert.pem'),key:readFileSync('/identity/key.pem'),rejectUnauthorized:true,agent:false,method,signal:AbortSignal.timeout(10000),headers:{prefer,...(path.startsWith('/api/customer/orders')&&method==='POST'?{'idempotency-key':idempotencyKey}:{}),...(proxy?{'x-compat-proxy':proxy}:{}),...(data?{'content-type':'application/json','content-length':data.length}:{} )},...options},res=>{
      const chunks=[];let size=0;
      res.on('data',chunk=>{size+=chunk.length;if(size>2_000_000)req.destroy(new Error('Response bound'));else chunks.push(chunk);});
      res.on('error',reject);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,rawBody:Buffer.concat(chunks)}));
    });req.on('error',reject);req.end(data);
  });
}
