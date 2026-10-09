import assert from 'node:assert/strict';
import { createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { request } from '@playwright/test';

const expected = process.env.LAB_SCOPE_CASE;
assert.ok(expected === 'present' || expected === 'missing', 'Expected present or missing scope case');
assert.match(process.env.LAB_PROJECT ?? '', /^magic-shop-matrix-[a-z0-9-]+$/, 'Use only an isolated matrix project');
const target = {
  'customer-catalog': { audience: 'catalog-api', scope: 'catalog.quote', origin: 'https://catalog-api:8443', path: '/internal/catalog/quotes', method: 'POST' },
  'insights-reporting': { audience: 'customer-api', scope: 'reporting.read', origin: 'https://customer-api:8443', path: '/internal/reporting/orders?limit=1', method: 'GET' }
}[process.env.LAB_SCOPE_CLIENT];
assert.ok(target, 'Expected an allowlisted service client');
const issuer = 'https://auth.magic.test:9443/realms/magic-shop';
const secret = readFileSync('/service-secret/client-secret', 'utf8').trim();
assert.ok(secret, 'Service secret missing');

async function boundedJson(response) {
  assert.equal(response.status, 200, `Keycloak returned ${response.status}`);
  const reader = response.body?.getReader();
  assert.ok(reader, 'Keycloak response body missing');
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1_048_576) { await reader.cancel(); throw new Error('Keycloak response exceeded bound'); }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
const issued = await boundedJson(await fetch(`${issuer}/protocol/openid-connect/token`, {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'client_credentials', client_id: process.env.LAB_SCOPE_CLIENT, client_secret: secret }),
  signal: AbortSignal.timeout(10_000)
}));
assert.equal(typeof issued.access_token, 'string');
const parts = issued.access_token.split('.');
assert.equal(parts.length, 3);
const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
assert.equal(header.alg, 'RS256');
assert.equal(typeof header.kid, 'string');
const jwks = await boundedJson(await fetch(`${issuer}/protocol/openid-connect/certs`, { signal: AbortSignal.timeout(10_000) }));
const jwk = jwks.keys?.find(key => key.kid === header.kid && key.kty === 'RSA');
assert.ok(jwk, 'Keycloak public signing key missing');
assert.ok(verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url')), 'Issued token signature invalid');
assert.equal(claims.iss, issuer);
assert.equal(claims.azp, process.env.LAB_SCOPE_CLIENT);
assert.equal(claims.typ, 'Bearer');
assert.equal(claims.cert_identity, undefined);
assert.ok((Array.isArray(claims.aud) ? claims.aud : [claims.aud]).includes(target.audience));
const scopes = typeof claims.scope === 'string' ? claims.scope.split(/\s+/) : [];
assert.equal(scopes.includes(target.scope), expected === 'present', `Unexpected ${target.scope} scope in ${expected} case`);

const context = await request.newContext({
  baseURL: target.origin,
  clientCertificates: [{ origin: target.origin, certPath: '/service-identity/cert.pem', keyPath: '/service-identity/key.pem' }],
  extraHTTPHeaders: { authorization: `Bearer ${issued.access_token}` },
  ignoreHTTPSErrors: false, timeout: 10_000
});
try {
  const response = target.method === 'POST'
    ? await context.post(target.path, { data: { lines: [{ itemId: 'wand-embers', quantity: 1 }] } })
    : await context.get(target.path);
  assert.equal(response.status(), expected === 'present' ? 200 : 403, `${target.audience} status for ${expected} scope`);
  console.log(`Real Keycloak ${process.env.LAB_SCOPE_CLIENT} token with ${expected} ${target.scope} scope and correct service certificate received ${response.status()}.`);
} finally { await context.dispose(); }
