// Serves the unchanged Vue build only on a disposable network; no API provider.
import https from 'node:https';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
let apiLeaks=0,authLeaks=0;
const options={cert:readFileSync('/server/cert.pem'),key:readFileSync('/server/key.pem'),ca:readFileSync('/public/client-ca.pem'),requestCert:true,rejectUnauthorized:true};
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2'};
const handle=async(req,res)=>{
  if(!req.socket.authorized || req.socket.getPeerCertificate().subject?.CN!=='synthetic-customer'){res.writeHead(403);res.end();return;}
  const path=new URL(req.url,'https://shop.magic.test').pathname;
  if(path==='/harness-audit'){res.setHeader('content-type','application/json');res.end(JSON.stringify({apiLeaks,authLeaks}));return;}
  if(path.startsWith('/api/')){apiLeaks++;res.writeHead(501);res.end('Mock route missing');return;}
  if(path.startsWith('/realms/')){authLeaks++;res.writeHead(501);res.end('Mock auth route missing');return;}
  const file=path==='/oidc-consumer'?'/example/oidc-consumer.html':resolve('/example/dist',`.${path}`);
  if(!file.startsWith('/example/')){res.writeHead(404);res.end();return;}
  try{const content=await readFile(file);res.setHeader('content-type',types[extname(file)]??'application/octet-stream');res.end(content);}
  catch{res.setHeader('content-type','text/html');res.end(await readFile('/example/dist/index.html'));}
};
for(const port of [8443,9443])https.createServer(options,(req,res)=>{void handle(req,res).catch(()=>{res.writeHead(500);res.end();});}).listen(port,'0.0.0.0');
