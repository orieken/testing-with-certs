// Synthetic compatibility upstream only; receives no real credentials.
import { createServer as httpServer } from 'node:http';
import { createServer as httpsServer } from 'node:https';
import { readFileSync, writeFileSync } from 'node:fs';
const { populated, item, regions, sales, FAULT_wrong_type, FAULT_tuple, FAULT_date, FAULT_tuple_position, FAULT_tuple_type, FAULT_date_calendar } = JSON.parse(readFileSync('/fixtures/data.json')); 
const read=path=>readFileSync(path);
let audit={requests:0,mutualTlsRequests:0,authorizationSeen:false,cookieSeen:false};
const faults={'wrong-type':FAULT_wrong_type,'tuple-invalid':FAULT_tuple,'date-invalid':FAULT_date,'tuple-position':FAULT_tuple_position,'tuple-type':FAULT_tuple_type,'date-calendar':FAULT_date_calendar};
function responseBody(req,mode){
  if(Object.hasOwn(faults,mode))return faults[mode];
  if(req.url.startsWith('/api/insights/regions'))return regions;
  if(req.url.startsWith('/api/insights/sales'))return sales;
  return req.method==='POST'?item:populated;
}
function observe(req){
  audit.requests++;if(req.socket.authorized)audit.mutualTlsRequests++;
  audit.authorizationSeen ||= Boolean(req.headers.authorization);audit.cookieSeen ||= Boolean(req.headers.cookie);
  writeFileSync('/fixtures/audit.json',JSON.stringify(audit));
}
function responseHeaders(status,mode){
  const headers={'content-type':'application/json'};
  if(status===201&&mode!=='missing-location')headers.location=`/api/catalog/items/${item.id}`;
  return headers;
}
function handle(req,res) {
  observe(req);const {mode}=JSON.parse(read('/fixtures/control.json'));
  if(mode==='501'){res.writeHead(501,{'content-type':'application/json'});res.end('{}');return;}
  if(req.method==='DELETE'){res.writeHead(204);res.end();return;}
  const status=req.method==='POST'?201:200;
  res.writeHead(status,responseHeaders(status,mode));res.end(JSON.stringify(responseBody(req,mode)));
}

const cert={key:read('/server/key.pem'),cert:read('/server/cert.pem'),minVersion:'TLSv1.2'};
for(const server of [httpServer(handle).listen(8090,'0.0.0.0'),httpsServer(cert,handle).listen(8444,'0.0.0.0'),httpsServer({...cert,ca:read('/public/client-ca.pem'),requestCert:true,rejectUnauthorized:true},handle).listen(8445,'0.0.0.0')]) {server.requestTimeout=5000;server.headersTimeout=5000;}
writeFileSync('/fixtures/audit.json',JSON.stringify(audit));
