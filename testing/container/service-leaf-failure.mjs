import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { request } from '@playwright/test';
import { ServiceTokenClient } from 'saturday-keycloak-prototype';

const kind = process.env.LAB_SERVICE_LEAF_FAILURE;
const expected = { revoked: /certificate revoked/i, expired: /certificate has expired/i, future: /certificate is not yet valid/i };
assert.ok(kind && Object.hasOwn(expected, kind), 'Expected revoked, expired or future service leaf');
const dir = kind === 'revoked' ? '/service-identity' : '/negative';
const verification = spawnSync('openssl', [
  'verify', '-purpose', 'sslclient', '-CAfile', '/public/service-ca.pem',
  '-CRLfile', '/public/service.crl.pem', '-crl_check', `${dir}/cert.pem`
], { encoding: 'utf8', timeout: 5_000, maxBuffer: 16_384 });
assert.notEqual(verification.status, 0, `The isolated ${kind} leaf must fail local chain and CRL validation`);
assert.match(`${verification.stdout}${verification.stderr}`, expected[kind]);

const origin = 'https://catalog-api:8443';
const token = await new ServiceTokenClient({
  target: { issuer: 'https://auth.magic.test:9443/realms/magic-shop', origins: ['https://auth.magic.test:9443'] },
  clientId: 'customer-catalog', secretFile: '/service-secret/client-secret',
  audience: 'catalog-api', scopes: ['catalog.quote'], timeoutMs: 10_000
}).getToken();
const context = await request.newContext({
  baseURL: origin,
  clientCertificates: [{ origin, certPath: `${dir}/cert.pem`, keyPath: `${dir}/key.pem` }],
  extraHTTPHeaders: { authorization: `Bearer ${token}` },
  ignoreHTTPSErrors: false, timeout: 5_000
});
try {
  await assert.rejects(
    context.post('/internal/catalog/quotes', { data: { lines: [{ itemId: 'wand-embers', quantity: 1 }] } }),
    `A fresh TLS connection with a ${kind} service certificate must fail before HTTP`
  );
  console.log(`${kind} service leaf rejected on a fresh verified catalog connection.`);
} finally { await context.dispose(); }
