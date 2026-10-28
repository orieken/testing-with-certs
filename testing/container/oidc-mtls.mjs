import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { probe } from '/skill/mtls.mjs';
const options = {
  url: 'https://shop.magic.test:8443/',
  ca: readFileSync('/public/server-ca.pem'),
  cert: readFileSync('/identity-customer/cert.pem'),
  key: readFileSync('/identity-customer/key.pem'),
};
assert.deepEqual(await probe(options), { kind: 'http', status: 200 });
assert.deepEqual(await probe({ ...options, cert: undefined, key: undefined }), { kind: 'tls-error' });
assert.deepEqual(await probe({ ...options, ca: readFileSync('/public/user-ca.pem') }), { kind: 'tls-error' });
assert.deepEqual(await probe({ ...options, servername: 'wrong.invalid' }), { kind: 'tls-error' });
assert.deepEqual(await probe(options), { kind: 'http', status: 200 });
console.log('PASS: verified mTLS controls; missing client, wrong server CA and wrong hostname rejected at TLS');
