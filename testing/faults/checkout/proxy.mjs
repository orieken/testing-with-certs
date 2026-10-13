import { createServer, request } from 'node:https';
import { readFileSync, writeFileSync } from 'node:fs';
import { malformedQuoteJson, invalidQuote } from './fault-fixtures.mjs';

const read = path => readFileSync(path);
const serverTrust = read('/trust/server-ca.pem');
const identity = { cert: read('/caller/cert.pem'), key: read('/caller/key.pem') };
const state = '/fault-state/control.json';
const modes = ['healthy', 'unavailable', 'delay', 'malformed-json', 'invalid-quote'];
let counters = { forwarded: 0, injected: 0, rejected: 0 };
function reset() { writeFileSync('/fault-state/audit.json', JSON.stringify(counters)); }
reset();
function control() {
  const value = JSON.parse(readFileSync(state, 'utf8'));
  if (!modes.includes(value.mode)) throw new Error('Invalid fault mode');
  return value.mode;
}
async function upstream(body, authorization) {
  return new Promise((resolve, reject) => {
    const req = request('https://catalog-api:8443/internal/catalog/quotes', {
      ...identity, ca: serverTrust, rejectUnauthorized: true, servername: 'catalog-api', agent: false,
      method: 'POST', signal: AbortSignal.timeout(5000), headers: { authorization, 'content-type': 'application/json', 'content-length': body.length }
    }, response => {
      const chunks = []; let bytes = 0;
      response.on('data', chunk => { bytes += chunk.length; if (bytes > 1_000_000) req.destroy(new Error('Body bound')); else chunks.push(chunk); });
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject); req.end(body);
  });
}
function send(res, status, body) { res.writeHead(status, { 'content-type': 'application/json', 'content-length': body.length, 'cache-control': 'no-store' }); res.end(body); }
async function quote(req, res) {
  if (!req.socket.authorized || req.socket.getPeerCertificate().subject?.CN !== 'customer-api') { counters.rejected++; reset(); send(res, 403, Buffer.from('{"code":"forbidden","message":"forbidden"}')); return; }
  if (req.url !== '/internal/catalog/quotes' || req.method !== 'POST') { send(res, 404, Buffer.from('{}')); return; }
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 16384) throw new Error('Request bound'); chunks.push(chunk); }
  const mode = control();
  // Real Go validates the unchanged signed service token and scoped client identity
  // before faults are applied. Headers/bodies/tokens are never logged or persisted.
  const result = await upstream(Buffer.concat(chunks), req.headers.authorization ?? '');
  counters.forwarded++;
  if (result.status !== 200 || mode === 'healthy') { reset(); send(res, result.status, result.body); return; }
  counters.injected++; reset();
  if (mode === 'unavailable') { req.socket.destroy(); return; }
  if (mode === 'delay') { const timer = setTimeout(() => send(res, 200, result.body), 12000); res.once('close', () => clearTimeout(timer)); return; }
  if (mode === 'malformed-json') { send(res, 200, Buffer.from(malformedQuoteJson)); return; }
  // Deliberately invalid fault fixture: type/arithmetic violate canonical quote.
  send(res, 200, Buffer.from(JSON.stringify(invalidQuote)));
}
const server = createServer({ key: read('/credentials/key.pem'), cert: read('/credentials/cert.pem'), ca: read('/trust/service-ca.pem'), crl: read('/trust/service.crl.pem'), minVersion: 'TLSv1.2', requestCert: true, rejectUnauthorized: true }, (req, res) => {
  void quote(req, res).catch(() => { if (!res.headersSent) send(res, 503, Buffer.from('{"code":"dependency_unavailable","message":"dependency_unavailable"}')); else res.destroy(); });
});
server.requestTimeout = 10000; server.headersTimeout = 10000; server.maxHeadersCount = 40;
server.listen(8443, '0.0.0.0');
