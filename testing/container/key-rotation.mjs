import assert from 'node:assert/strict';
import { createHash, createPublicKey, randomBytes, verify } from 'node:crypto';
import { request } from '@playwright/test';

const phase = process.env.LAB_ROTATION_PHASE;
assert.ok(phase === 'before' || phase === 'after', 'Expected before or after rotation phase');
assert.match(process.env.LAB_PROJECT ?? '', /^magic-shop-matrix-[a-z0-9-]+$/, 'Use only an isolated matrix project');
const shop = 'https://shop.magic.test:8443';
const auth = 'https://auth.magic.test:9443';
const issuer = `${auth}/realms/magic-shop`;
const certificate = (origin) => ({ origin, certPath: '/identity-admin/cert.pem', keyPath: '/identity-admin/key.pem' });
const context = await request.newContext({
  clientCertificates: [certificate(shop), certificate(auth)], ignoreHTTPSErrors: false, timeout: 10_000
});
try {
  const verifier = randomBytes(32).toString('base64url');
  const state = randomBytes(16).toString('base64url');
  const url = new URL(`${issuer}/protocol/openid-connect/auth`);
  for (const [key, value] of Object.entries({
    response_type: 'code', client_id: 'shop-spa', redirect_uri: `${shop}/callback`, scope: 'openid profile',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', state
  })) url.searchParams.set(key, value);
  const authorization = await context.get(url.href, { maxRedirects: 0 });
  assert.equal(authorization.status(), 302, 'Certificate PKCE authorization failed');
  const callback = new URL(authorization.headers().location, auth);
  assert.equal(callback.origin, shop);
  assert.equal(callback.pathname, '/callback');
  assert.equal(callback.searchParams.get('state'), state);
  const code = callback.searchParams.get('code');
  assert.ok(code, 'Authorization code missing');
  const exchange = await context.post(`${issuer}/protocol/openid-connect/token`, {
    form: { grant_type: 'authorization_code', client_id: 'shop-spa', code, redirect_uri: `${shop}/callback`, code_verifier: verifier }
  });
  assert.equal(exchange.status(), 200, 'PKCE exchange failed');
  const tokenResponse = await exchange.json();
  assert.equal(typeof tokenResponse.access_token, 'string');
  const parts = tokenResponse.access_token.split('.');
  assert.equal(parts.length, 3);
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  assert.equal(header.alg, 'RS256');
  assert.equal(typeof header.kid, 'string');
  assert.equal(claims.iss, issuer);
  assert.equal(claims.azp, 'shop-spa');
  assert.equal(claims.cert_identity, '22222222-2222-4222-8222-222222222222');
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  for (const audience of ['catalog-api', 'customer-api', 'insights-api']) assert.ok(audiences.includes(audience));
  const jwksResponse = await context.get(`${issuer}/protocol/openid-connect/certs`);
  assert.equal(jwksResponse.status(), 200);
  const jwks = await jwksResponse.json();
  assert.ok(Array.isArray(jwks.keys) && jwks.keys.length <= 20);
  const key = jwks.keys.find(value => value.kid === header.kid && value.kty === 'RSA');
  assert.ok(key, 'Issued signing key missing from JWKS');
  assert.ok(verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key, format: 'jwk' }), Buffer.from(parts[2], 'base64url')), 'Issued token signature invalid');
  const api = await request.newContext({
    baseURL: shop, clientCertificates: [certificate(shop)], ignoreHTTPSErrors: false, timeout: 10_000,
    extraHTTPHeaders: { authorization: `Bearer ${tokenResponse.access_token}` }
  });
  try {
    for (const path of ['/api/catalog/items?limit=1', '/api/customer/me', '/api/insights/regions?limit=1']) {
      const response = await api.get(path);
      assert.equal(response.status(), 200, `${phase} key request to ${path} returned ${response.status()}`);
    }
  } finally { await api.dispose(); }
  console.log(`${phase} rotation: Keycloak-signed admin token kid ${header.kid} passed Go, Node and Python with strict TLS and the selected user certificate.`);
} finally { await context.dispose(); }
