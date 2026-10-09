import {createServer} from 'node:https';
import type {ServerResponse, IncomingMessage} from 'node:http';
import {TLSSocket} from 'node:tls';
import {readFileSync} from 'node:fs';
import {authorizeIdentity} from '../domain/identity.js';
import {verifyAccessToken} from './token.js';
const assets=new Map<string, readonly [string, Buffer]>([
  ['/', ['text/html',readFileSync('/work/src/landing.html')]],
  ['/callback', ['text/html',readFileSync('/work/src/landing.html')]],
  ['/app.js', ['text/javascript',readFileSync('/work/public/app.js')]],
] as const);
function reply(response:ServerResponse, status:number, body:unknown) {
  response.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});
  response.end(JSON.stringify(body));
}
async function identity(request:IncomingMessage,response:ServerResponse) {
  const authorization=request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return reply(response,401,{error:'invalid_token'});
  let user;
  try { user=await verifyAccessToken(authorization.slice(7)); }
  catch { return reply(response,401,{error:'invalid_token'}); }
  const value=request.headers['x-cert-identity'];
  try { reply(response,200,authorizeIdentity(typeof value==='string' ? value : undefined,user)); }
  catch { reply(response,403,{error:'identity_mismatch'}); }
}
async function route(request:IncomingMessage,response:ServerResponse) {
  const socket=request.socket;
  if (!(socket instanceof TLSSocket) || socket.getPeerCertificate().subject?.CN !== 'gateway') return reply(response,403,{error:'invalid_gateway'});
  if (request.method !== 'GET') return reply(response,405,{error:'method_not_allowed'});
  if (request.url === '/api/identity') return identity(request,response);
  const asset=assets.get(request.url?.split('?')[0] ?? '/');
  if (!asset) return reply(response,404,{error:'not_found'});
  response.writeHead(200,{'content-type':asset[0],'cache-control':'no-store','content-security-policy':"default-src 'self'; script-src 'self'; connect-src 'self' https://auth.magic.test:9443; frame-src https://auth.magic.test:9443; object-src 'none'; base-uri 'none'"});
  response.end(asset[1]);
}
const server=createServer({key:readFileSync('/landing/key.pem'),cert:readFileSync('/landing/cert.pem'),ca:readFileSync('/public/service-ca.pem'),crl:readFileSync('/public/service.crl.pem'),requestCert:true,rejectUnauthorized:true,minVersion:'TLSv1.2'},(request,response)=>{void route(request,response).catch(()=>reply(response,500,{error:'internal_error'}));});
server.requestTimeout=10000;
server.headersTimeout=10000;
server.timeout=10000;
server.listen(8443,'0.0.0.0');
