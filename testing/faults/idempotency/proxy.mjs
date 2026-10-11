// Test-only response loss. No response fabrication, token minting or application routes changed.
import { createServer, request } from 'node:https';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
const read = path => readFileSync(path);
const customerIdentity = { cert: read('/caller/cert.pem'), key: read('/caller/key.pem') };
function forward(body, headers) {
  return new Promise((resolve, reject) => {
    const req = request('https://shop.magic.test:8443/api/customer/orders', {
      ...customerIdentity, ca: read('/trust/server-ca.pem'), rejectUnauthorized: true, agent: false,
      method: 'POST', signal: AbortSignal.timeout(10000), headers: {
        authorization: headers.authorization ?? '', 'idempotency-key': headers['idempotency-key'] ?? '',
        'content-type': 'application/json', 'content-length': body.length
      }
    }, response => {
      const chunks = []; let size = 0;
      response.on('data', chunk => { size += chunk.length; if (size > 1_000_000) req.destroy(new Error('Response bound')); else chunks.push(chunk); });
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, rawBody: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject); req.end(body);
  });
}
async function discard(req, res) {
  if (!req.socket.authorized || req.socket.getPeerCertificate().subject?.CN !== '11111111-1111-4111-8111-111111111111') { res.writeHead(403); res.end(); return; }
  if (req.method !== 'POST' || req.url !== '/api/customer/orders') { res.writeHead(404); res.end(); return; }
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 16384) throw new Error('Request bound'); chunks.push(chunk); }
  const upstream = await forward(Buffer.concat(chunks), req.headers);
  if (upstream.status !== 201) { res.writeHead(upstream.status, { 'content-type': 'application/json' }); res.end(upstream.rawBody); return; }
  // The real API sends 201 only after its database COMMIT. Persist no credentials.
  const receipt = { status: upstream.status, headers: Object.fromEntries(['content-type', 'location', 'cache-control'].filter(name => upstream.headers[name] !== undefined).map(name => [name, upstream.headers[name]])), rawBody: upstream.rawBody };
  writeFileSync('/loss-state/receipt.next', JSON.stringify(receipt), { mode: 0o600 });
  renameSync('/loss-state/receipt.next', '/loss-state/receipt.json');
  req.socket.destroy(); // Intentionally send no response headers to the client.
}
const server = createServer({ key: read('/credentials/key.pem'), cert: read('/credentials/cert.pem'),
  ca: read('/trust/user-ca.pem'), crl: read('/trust/user.crl.pem'), minVersion: 'TLSv1.2', requestCert: true, rejectUnauthorized: true
}, (req, res) => { void discard(req, res).catch(() => { if (!res.headersSent) { res.writeHead(502); res.end(); } else res.destroy(); }); });
server.requestTimeout = 10000; server.headersTimeout = 10000; server.maxHeadersCount = 40;
server.listen(8443, '0.0.0.0');
