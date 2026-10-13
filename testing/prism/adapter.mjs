// Mock-only verified mTLS front; fixed credential-free HTTP hop to private Prism.
import { createServer } from 'node:https';
import { request } from 'node:http';
import { readFileSync } from 'node:fs';
const read=path=>readFileSync(path);
const services={catalog:'catalog-mock',customer:'customer-mock',insights:'insights-mock'};
const probes=['proxy-report','proxy-errors','proxy-insights','proxy-tls','proxy-bad-ca','proxy-bad-name','proxy-mtls'];
function callerAllowed(req){return req.socket.authorized&&req.socket.getPeerCertificate().subject?.CN==='synthetic-customer';}
function relay(req,res) {
  if(!callerAllowed(req)){res.writeHead(403);res.end();return;}
  if(req.url==='/ready'){res.writeHead(200);res.end('ready');return;}
  const service=services[req.url.split('/')[2]];
  const selected=req.headers['x-compat-proxy'];
  const target=selected&&probes.includes(selected)?selected:service;
  if(!target){res.writeHead(404);res.end();return;}
  const headers=Object.fromEntries(['content-type','accept','prefer','content-length','idempotency-key'].filter(name=>req.headers[name]!==undefined).map(name=>[name,req.headers[name]]));
  const upstream=request({hostname:target,port:4010,path:req.url,method:req.method,headers,signal:AbortSignal.timeout(5000)},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});
  upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});req.on('aborted',()=>upstream.destroy());req.pipe(upstream);
}
const server=createServer({key:read('/server/key.pem'),cert:read('/server/cert.pem'),ca:read('/public/client-ca.pem'),requestCert:true,rejectUnauthorized:true,minVersion:'TLSv1.2'},relay);
server.requestTimeout=10000;server.headersTimeout=10000;server.maxHeadersCount=40;server.listen(8443,'0.0.0.0');
