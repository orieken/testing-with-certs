import assert from 'node:assert/strict';
import { constants, createHash, createPrivateKey, createPublicKey, randomBytes, sign, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { request } from '@playwright/test';

assert.match(process.env.LAB_PROJECT ?? '', /^magic-shop-matrix-jwt[a-z0-9-]*$/, 'Use a disposable JWT matrix project');
const shop = 'https://shop.magic.test:8443';
const auth = 'https://auth.magic.test:9443';
const issuer = `${auth}/realms/magic-shop`;
const privateKey = createPrivateKey(readFileSync('/matrix-key/private.pem'));
const expectedPublic = createPublicKey(privateKey).export({ format: 'jwk' });
const certificate = origin => ({ origin, certPath: '/identity-admin/cert.pem', keyPath: '/identity-admin/key.pem' });
const context = await request.newContext({
  clientCertificates: [certificate(shop), certificate(auth)], ignoreHTTPSErrors: false, timeout: 10_000
});
const paths = ['/api/catalog/items?limit=1', '/api/customer/me', '/api/insights/regions?limit=1'];

function decode(segment) { return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')); }
function encode(value) { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
function signed(header, claims) {
  const input = `${encode(header)}.${encode(claims)}`;
  const signature = sign('sha256', Buffer.from(input), header.alg === 'PS256'
    ? { key: privateKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 }
    : privateKey);
  return `${input}.${signature.toString('base64url')}`;
}
async function expectAll(name, token, status) {
  for (const path of paths) {
    const response = await context.get(`${shop}${path}`, {
      headers: token === null ? {} : { authorization: `Bearer ${token}` }
    });
    assert.equal(response.status(), status, `${name} at ${path} returned ${response.status()}, expected ${status}`);
  }
  console.log(`${name}: Go, Node and Python returned ${status}.`);
}

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
  assert.equal(exchange.status(), 200, 'PKCE token exchange failed');
  const tokens = await exchange.json();
  assert.equal(typeof tokens.access_token, 'string');
  assert.equal(typeof tokens.id_token, 'string');
  const parts = tokens.access_token.split('.');
  assert.equal(parts.length, 3);
  const header = decode(parts[0]);
  const claims = decode(parts[1]);
  assert.equal(header.alg, 'RS256');
  assert.equal(claims.iss, issuer);
  assert.equal(claims.cert_identity, '22222222-2222-4222-8222-222222222222');
  const jwksResponse = await context.get(`${issuer}/protocol/openid-connect/certs`);
  assert.equal(jwksResponse.status(), 200);
  const jwks = await jwksResponse.json();
  const published = jwks.keys.find(key => key.kid === header.kid && key.kty === 'RSA');
  assert.ok(published, 'Keycloak signing key not published');
  assert.equal(published.n, expectedPublic.n, 'Test signer differs from Keycloak active key');
  assert.equal(published.e, expectedPublic.e);
  const publicKey = createPublicKey({ key: published, format: 'jwk' });
  assert.ok(verify('sha256', Buffer.from(`${parts[0]}.${parts[1]}`), publicKey,
    Buffer.from(parts[2], 'base64url')), 'Keycloak token signature invalid');
  await expectAll('Valid Keycloak access token baseline', tokens.access_token, 200);

  const now = Math.floor(Date.now() / 1000);
  const alteredSignature = `${parts[0]}.${parts[1]}.${parts[2][0] === 'A' ? 'B' : 'A'}${parts[2].slice(1)}`;
  const cases = [
    ['Missing bearer', null],
    ['Altered signature', alteredSignature],
    ['Expired signed token', signed(header, { ...claims, iat: now - 240, exp: now - 120 })],
    ['Not-yet-valid signed token', signed(header, { ...claims, nbf: now + 120 })],
    ['Wrong-issuer signed token', signed(header, { ...claims, iss: 'https://wrong.magic.test/realms/magic-shop' })],
    ['Wrong-audience signed token', signed(header, { ...claims, aud: 'other-api' })],
    ['Wrong-algorithm signed token', signed({ ...header, alg: 'PS256' }, claims)],
    ['Signed ID token', tokens.id_token],
    ['Unknown-key signed token', signed({ ...header, kid: 'missing-matrix-key' }, claims)]
  ];
  for (const [name, token] of cases) {
    if (token !== null && !['Altered signature', 'Signed ID token'].includes(name)) {
      const segments = token.split('.');
      const algorithm = decode(segments[0]).alg;
      assert.ok(verify('sha256', Buffer.from(`${segments[0]}.${segments[1]}`),
        algorithm === 'PS256' ? { key: publicKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 } : publicKey,
        Buffer.from(segments[2], 'base64url')), `${name} fixture signature invalid`);
    }
    await expectAll(name, token, 401);
  }
  console.log(`JWT-01 live matrix passed with active Keycloak kid ${header.kid}; strict TLS and selected admin certificate.`);
} finally { await context.dispose(); }
