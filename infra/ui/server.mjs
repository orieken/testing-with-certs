import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { readFileSync, statSync, createReadStream } from 'node:fs';
import { resolve, extname, sep } from 'node:path';

const dist = '/app/dist';
const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.woff2', 'font/woff2'],
]);

const tls = {
  key: readFileSync('/credentials/key.pem'),
  cert: readFileSync('/credentials/cert.pem'),
  ca: readFileSync('/trust/service-ca.pem'),
  requestCert: true,
  rejectUnauthorized: true,
  minVersion: 'TLSv1.2',
};

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

const server = createHttpsServer(tls, (req, res) => {
  const peer = req.socket.getPeerCertificate();
  if (!req.socket.authorized || peer?.subject?.CN !== 'gateway') {
    send(res, 403, 'Forbidden');
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'Method not allowed');
    return;
  }
  const pathname = new URL(req.url ?? '/', 'https://ui:8443').pathname;
  if (pathname.startsWith('/api/') || pathname.startsWith('/internal/')) {
    send(res, 404, 'Not found');
    return;
  }
  const candidate = resolve(dist, `.${pathname}`);
  if (candidate !== dist && !candidate.startsWith(`${dist}${sep}`)) {
    send(res, 404, 'Not found');
    return;
  }
  let file = candidate;
  try {
    if (!statSync(file).isFile()) file = resolve(dist, 'index.html');
  } catch {
    file = resolve(dist, 'index.html');
  }
  res.writeHead(200, { 'content-type': mime.get(extname(file)) ?? 'application/octet-stream', 'x-content-type-options': 'nosniff' });
  if (req.method === 'HEAD') res.end();
  else createReadStream(file).pipe(res);
});
server.requestTimeout = 10_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;
server.listen(8443, '0.0.0.0');

const management = createHttpServer((req, res) => {
  if (req.url === '/health/ready') send(res, 200, 'UP');
  else send(res, 404, 'Not found');
});
management.requestTimeout = 5_000;
management.listen(9000, '127.0.0.1');
