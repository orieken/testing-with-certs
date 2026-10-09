import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { request } from '@playwright/test';

const project = process.env.LAB_PROJECT;
assert.match(project ?? '', /^magic-shop-matrix-user-crl[a-z0-9-]*$/, 'Use a disposable user-CRL project');
assert.equal(process.env.LAB_USER, 'customer-waterdeep');
const published = Number(process.env.LAB_CRL_PUBLISHED_EPOCH_MS);
assert.ok(Number.isSafeInteger(published) && published > 0, 'Publication timestamp required');
const boundMs = 60_000;
const shop = 'https://shop.magic.test:8443';
const auth = 'https://auth.magic.test:9443';

const verification = spawnSync('openssl', [
  'verify', '-purpose', 'sslclient', '-CAfile', '/public/user-ca.pem',
  '-CRLfile', '/public/user.crl.pem', '-crl_check', '/identity/cert.pem'
], { encoding: 'utf8', timeout: 5_000, maxBuffer: 16_384 });
assert.notEqual(verification.status, 0, 'Selected leaf must be revoked in the published CRL');
assert.match(`${verification.stdout}${verification.stderr}`, /certificate revoked/i);

const baseline = await request.newContext({ ignoreHTTPSErrors: false, timeout: 5_000 });
try {
  const response = await baseline.get(`${auth}/realms/magic-shop/.well-known/openid-configuration`);
  assert.equal(response.status(), 200, 'Keycloak must be reachable with verified server TLS');
} finally { await baseline.dispose(); }

const context = await request.newContext({
  clientCertificates: [shop, auth].map(origin => ({ origin, certPath: '/identity/cert.pem', keyPath: '/identity/key.pem' })),
  ignoreHTTPSErrors: false,
  timeout: 5_000
});
try {
  let shopRejected = false;
  try {
    const response = await context.get(shop, { maxRedirects: 0 });
    shopRejected = response.status() === 403;
  } catch (error) {
    shopRejected = /certificate|handshake|tls|ssl/i.test(String(error));
  }
  assert.ok(shopRejected, 'Fresh shop TLS connection must reject the revoked leaf');
  const shopElapsedMs = Date.now() - published;
  assert.ok(shopElapsedMs >= 0 && shopElapsedMs <= boundMs, `Shop rejection exceeded ${boundMs} ms: ${shopElapsedMs}`);

  const verifier = randomBytes(32).toString('base64url');
  const url = new URL(`${auth}/realms/magic-shop/protocol/openid-connect/auth`);
  for (const [name, value] of Object.entries({
    response_type: 'code', client_id: 'shop-spa', redirect_uri: `${shop}/callback`, scope: 'openid profile',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
    state: randomBytes(12).toString('base64url')
  })) url.searchParams.set(name, value);
  let code = null;
  let denied = false;
  try {
    const response = await context.get(url.href, { maxRedirects: 0 });
    const location = response.headers().location;
    if (location) code = new URL(location, auth).searchParams.get('code');
    const body = (await response.text()).toLowerCase();
    denied = (response.status() >= 400 || response.status() === 200) &&
      /invalid user|authentication failed|certificate|account is disabled/.test(body) &&
      !/type=["']password["']/.test(body);
  } catch (error) {
    denied = /certificate|handshake|tls|ssl/i.test(String(error));
  }
  assert.equal(code, null, 'Revoked certificate must receive no authorization code');
  assert.ok(denied, 'Keycloak must deny authorization, not redirect to a callback');
  const authElapsedMs = Date.now() - published;
  assert.ok(authElapsedMs >= 0 && authElapsedMs <= boundMs, `Keycloak rejection exceeded ${boundMs} ms: ${authElapsedMs}`);
  console.log(`Revoked user CRL published at ${new Date(published).toISOString()}; shop rejection by ${shopElapsedMs} ms; Keycloak no-code denial by ${authElapsedMs} ms (60,000 ms bound).`);
} finally { await context.dispose(); }
