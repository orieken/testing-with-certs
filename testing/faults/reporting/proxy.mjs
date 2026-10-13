import { createServer, request as secure } from 'node:https';
import { request as plain } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
const read=p=>readFileSync(p);let counts={generation:'',calls:0,authorized:0,rejected:0};
function audit(){writeFileSync('/fault-state/audit.json',JSON.stringify(counts));}audit();
function get(request,options){return new Promise((resolve,reject)=>{const req=request(options,res=>{let bytes=0;const chunks=[];res.on('data',x=>{bytes+=x.length;if(bytes>1048576)req.destroy(Error('bounded'));else chunks.push(x);});res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks),headers:res.headers}));res.on('error',reject);});req.on('error',reject);req.end();});}
function send(res,result){res.writeHead(result.status,{'content-type':'application/json','cache-control':'no-store'});res.end(result.body);}
function rejectCaller(req,res){
 if(req.socket.authorized&&req.socket.getPeerCertificate().subject?.CN==='insights-api')return false;
 counts.rejected++;audit();send(res,{status:403,body:'{"code":"forbidden","message":"forbidden"}'});return true;
}
function target(req){
 const url=new URL(req.url,'https://customer-api');
 if(req.method!=='GET'||url.pathname!=='/internal/reporting/orders')throw Error('route');
 return url;
}
function control(){
 const selected=JSON.parse(read('/fault-state/control.json'));
 if(counts.generation!==selected.generation)counts={generation:selected.generation,calls:0,authorized:0,rejected:0};
 return selected;
}
function authorizedPage(req){
 // Validate the original signed token on real Node before any mock delivery.
 return get(secure,{host:'customer-api',port:8443,servername:'customer-api',path:'/internal/reporting/orders?limit=100&from=2026-09-01T00%3A00%3A00Z&to=2026-10-01T00%3A00%3A00Z',ca:read('/trust/server-ca.pem'),cert:read('/caller/cert.pem'),key:read('/caller/key.pem'),rejectUnauthorized:true,agent:false,signal:AbortSignal.timeout(5000),headers:{authorization:req.headers.authorization??''}});
}
function mockPage(url,selected){
 url.searchParams.set('mode',selected.mode);url.searchParams.set('generation',selected.generation);
 return get(plain,{host:'reporting-mock',port:8081,path:url.pathname+url.search,agent:false,signal:AbortSignal.timeout(5000)});
}
async function handle(req,res){
 if(rejectCaller(req,res))return;
 const url=target(req),selected=control();
 const oracle=await authorizedPage(req);
 if(oracle.status!==200){send(res,oracle);return;}
 counts.authorized++;
 const result=await mockPage(url,selected);
 counts.calls++;audit();send(res,result);
}
const server=createServer({key:read('/credentials/key.pem'),cert:read('/credentials/cert.pem'),ca:read('/trust/service-ca.pem'),crl:read('/trust/service.crl.pem'),minVersion:'TLSv1.2',requestCert:true,rejectUnauthorized:true},(req,res)=>void handle(req,res).catch(()=>send(res,{status:503,body:'{"code":"dependency_unavailable","message":"dependency_unavailable"}'})));
server.headersTimeout=10000;server.requestTimeout=10000;server.maxHeadersCount=40;server.listen(8443,'0.0.0.0');
