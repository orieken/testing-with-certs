import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

assert.match(process.env.LAB_PROJECT ?? '', /^magic-shop-matrix-jwt[a-z0-9-]*$/, 'Use a disposable JWT matrix project');
assert.equal(process.env.LAB_JWT_MATRIX, 'yes', 'Explicit JWT matrix flag required');
const origin = 'https://auth.magic.test:9443';
const realmPath = '/admin/realms/magic-shop';
const secret = readFileSync('/secrets/admin/client-secret', 'utf8').trim();
assert.ok(secret, 'Admin secret missing');

async function bounded(response, allowed) {
  assert.ok(allowed.includes(response.status), `Keycloak returned ${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) return undefined;
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    assert.ok(size <= 1_048_576, 'Keycloak response exceeded bound');
    chunks.push(value);
  }
  return size ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
}
async function call(method, path, token, body, allowed = [200]) {
  return bounded(await fetch(`${origin}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000)
  }), allowed);
}
const session = await bounded(await fetch(`${origin}/realms/master/protocol/openid-connect/token`, {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'client_credentials', client_id: 'lab-bootstrap', client_secret: secret }),
  signal: AbortSignal.timeout(10_000)
}), [200]);
assert.equal(typeof session?.access_token, 'string', 'Admin token missing');
const admin = session.access_token;
const realm = await call('GET', realmPath, admin);
assert.equal(typeof realm?.id, 'string', 'Realm ID missing');
const existing = await call('GET', `${realmPath}/components?type=org.keycloak.keys.KeyProvider`, admin);
assert.ok(Array.isArray(existing) && existing.length <= 20, 'Key provider list invalid');
assert.ok(!existing.some(value => value.name === 'matrix-imported-rsa'), 'Matrix key already installed');
const priorities = existing.map(value => Number(value.config?.priority?.[0])).filter(Number.isFinite);
const priority = Math.max(1000, ...priorities.map(value => value + 1));
const pair = generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 0x10001 });
const privatePem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
writeFileSync('/matrix-key/private.pem', privatePem, { mode: 0o600, flag: 'wx' });
await call('POST', `${realmPath}/components`, admin, {
  name: 'matrix-imported-rsa', providerId: 'rsa', providerType: 'org.keycloak.keys.KeyProvider', parentId: realm.id,
  config: { priority: [String(priority)], enabled: ['true'], active: ['true'], algorithm: ['RS256'], privateKey: [privatePem] }
}, [201, 204]);
const keys = await call('GET', `${realmPath}/keys`, admin);
const kid = keys?.active?.RS256;
assert.equal(typeof kid, 'string', 'Active RS256 key missing');
const jwks = await bounded(await fetch(`${origin}/realms/magic-shop/protocol/openid-connect/certs`, {
  signal: AbortSignal.timeout(10_000)
}), [200]);
const expected = pair.publicKey.export({ format: 'jwk' });
assert.ok(jwks?.keys?.some(key => key.kid === kid && key.n === expected.n && key.e === expected.e),
  'Imported public key not active in realm JWKS');
console.log(`Disposable Keycloak imported RSA key is active and published in JWKS (kid ${kid}).`);
