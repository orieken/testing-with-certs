import https from 'node:https';
import { readFileSync } from 'node:fs';

const options = {
  hostname: 'shop.magic.test',
  port: 8443,
  path: '/',
  method: 'GET',
  ca: readFileSync('/public/server-ca.pem'),
  cert: readFileSync('/identity/cert.pem'),
  key: readFileSync('/identity/key.pem'),
  servername: 'shop.magic.test',
  timeout: 10_000,
};

await new Promise((resolve, reject) => {
  const request = https.request(options, response => {
    response.resume();
    if (response.statusCode === 403) {
      console.log('Revoked certificate rejected by shop on a new verified TLS connection (HTTP 403)');
      resolve();
    } else {
      reject(new Error(`Revoked certificate received shop status ${response.statusCode}`));
    }
  });
  request.on('timeout', () => request.destroy(new Error('TLS request timed out')));
  request.on('error', error => {
    if (/certificate revoked|bad certificate|handshake failure/i.test(error.message)) {
      console.log(`Revoked certificate rejected by shop on a new verified TLS connection (${error.code})`);
      resolve();
    } else {
      reject(error);
    }
  });
  request.end();
});
