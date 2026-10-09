import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { request } from '@playwright/test';

const kind = process.env.LAB_USER_LEAF_FAILURE;
const expected = { expired: /certificate has expired/i, future: /certificate is not yet valid/i };
assert.ok(kind && Object.hasOwn(expected, kind), 'Expected expired or future user leaf');
const verification = spawnSync('openssl', [
  'verify', '-purpose', 'sslclient', '-CAfile', '/public/user-ca.pem',
  '-CRLfile', '/public/user.crl.pem', '-crl_check', '/negative/cert.pem'
], { encoding: 'utf8', timeout: 5_000, maxBuffer: 16_384 });
assert.notEqual(verification.status, 0);
assert.match(`${verification.stdout}${verification.stderr}`, expected[kind]);

const shop = 'https://shop.magic.test:8443';
const auth = 'https://auth.magic.test:9443';
const context = await request.newContext({
  clientCertificates: [shop, auth].map(origin => ({ origin, certPath: '/negative/cert.pem', keyPath: '/negative/key.pem' })),
  ignoreHTTPSErrors: false, timeout: 5_000
});
try {
  await assert.rejects(context.get(shop), 'Invalid user leaf must fail the shop TLS gate before HTTP');
  const verifier = randomBytes(32).toString('base64url');
  const url = new URL(`${auth}/realms/magic-shop/protocol/openid-connect/auth`);
  for (const [name, value] of Object.entries({
    response_type: 'code', client_id: 'shop-spa', redirect_uri: `${shop}/callback`, scope: 'openid profile',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', state: randomBytes(12).toString('base64url')
  })) url.searchParams.set(name, value);
  let code = null;
  try {
    const response = await context.get(url.href, { maxRedirects: 0 });
    const location = response.headers().location;
    if (location) code = new URL(location, auth).searchParams.get('code');
  } catch { /* Invalid client certificates may terminate the TLS handshake. */ }
  assert.equal(code, null, 'Invalid user leaf must not receive an authorization code');
  console.log(`${kind} user leaf rejected by the shop and received no Keycloak authorization code.`);
} finally { await context.dispose(); }
