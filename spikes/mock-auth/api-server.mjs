// A test-only TLS/delay adapter. Only the private Prism service can be reached.
// No real API destination, authentication injection, token or client certificate.
import https from 'node:https';
import http from 'node:http';
import { readFileSync } from 'node:fs';
const faults=JSON.parse(readFileSync('/work/spikes/mock-auth/fixtures.json'));
https.createServer({key:readFileSync('/tls/api.key'),cert:readFileSync('/tls/api.pem')}, async(req,res)=>{
  if(req.url==='/ready') {res.writeHead(200);res.end('ready');return;}
  const scenario=req.headers['x-test-scenario'];
  if(scenario==='delay') await new Promise(r=>setTimeout(r,800));
  if(req.destroyed) return;
  if(scenario==='FAULT_wrong_type') {res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(faults.FAULT_wrong_type));return;}
  const headers={...req.headers,host:'prism:4010'};
  for(const name of ['x-test-scenario','authorization','proxy-authorization','cookie']) delete headers[name];
  const upstream=http.request({hostname:'prism',port:4010,path:req.url,method:req.method,headers},response=>{
    res.writeHead(response.statusCode,response.headers);response.pipe(res);
  });
  upstream.setTimeout(1500,()=>upstream.destroy());
  upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});
  req.on('aborted',()=>upstream.destroy());req.pipe(upstream);
}).listen(8443,'0.0.0.0');
