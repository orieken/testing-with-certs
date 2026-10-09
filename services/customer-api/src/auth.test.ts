import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exportJWK, generateKeyPair, SignJWT, type JSONWebKeySet } from 'jose';
import { AccessTokenVerifier, AuthFailure, issuer } from './auth.js';

const sub = '10101010-1010-4010-8010-101010101010';
const now = Math.floor(Date.now() / 1000);

async function key(kid: string) {
  const pair = await generateKeyPair('RS256', { extractable: true });
  return { privateKey: pair.privateKey, publicJwk: { ...await exportJWK(pair.publicKey), kid, alg: 'RS256', use: 'sig' } };
}

async function token(privateKey: CryptoKey, kid: string, options: {
  audience?: string; issuer?: string; expires?: number; issued?: number; notBefore?: number;
  caller?: string; scope?: string; certificateIdentity?: string;
} = {}): Promise<string> {
  const claims: Record<string, unknown> = {
    typ: 'Bearer', azp: options.caller ?? 'shop-spa',
    ...(options.caller ? { scope: options.scope ?? 'reporting.read' } : { cert_identity: options.certificateIdentity ?? sub, realm_access: { roles: ['customer'] } })
  };
  let signed = new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid })
    .setSubject(sub).setIssuer(options.issuer ?? issuer).setAudience(options.audience ?? 'customer-api')
    .setIssuedAt(options.issued ?? now).setExpirationTime(options.expires ?? now + 120);
  if (options.notBefore !== undefined) signed = signed.setNotBefore(options.notBefore);
  return signed.sign(privateKey);
}

function rejectsStatus(status: 401 | 403) {
  return (error: unknown): boolean => error instanceof AuthFailure && error.status === status;
}

test('signed user tokens enforce expiration, not-before, issuer and audience', async () => {
  const active = await key('active');
  const verifier = new AccessTokenVerifier(async (): Promise<JSONWebKeySet> => ({ keys: [active.publicJwk] }));
  assert.equal((await verifier.authenticate(await token(active.privateKey, 'active'), 'gateway', sub)).sub, sub);
  for (const invalid of [
    { issued: now - 240, expires: now - 120 },
    { notBefore: now + 120 },
    { issuer: 'https://wrong.magic.test/realms/magic-shop' },
    { audience: 'catalog-api' }
  ]) {
    const signed = await token(active.privateKey, 'active', invalid);
    await assert.rejects(() => verifier.authenticate(signed, 'gateway', sub), rejectsStatus(401));
  }
});

test('unknown signing keys fail closed and a published second key is accepted', async () => {
  const first = await key('first'); const second = await key('second'); const absent = await key('absent');
  const published = [first.publicJwk]; let loads = 0;
  const verifier = new AccessTokenVerifier(async (): Promise<JSONWebKeySet> => { loads += 1; return { keys: [...published] }; });
  await verifier.authenticate(await token(first.privateKey, 'first'), 'gateway', sub);
  published.push(second.publicJwk);
  assert.equal((await verifier.authenticate(await token(second.privateKey, 'second'), 'gateway', sub)).sub, sub);
  const unknown = await token(absent.privateKey, 'absent');
  await assert.rejects(() => verifier.authenticate(unknown, 'gateway', sub), rejectsStatus(401));
  assert.equal(loads, 3);
});

test('service capability requires the matching caller and exact scope', async () => {
  const active = await key('service');
  const verifier = new AccessTokenVerifier(async (): Promise<JSONWebKeySet> => ({ keys: [active.publicJwk] }));
  const good = await token(active.privateKey, 'service', { caller: 'insights-reporting', scope: 'openid reporting.read' });
  assert.equal((await verifier.authenticate(good, 'insights-api', '')).service, true);
  for (const invalid of [
    { caller: 'insights-reporting', scope: 'openid' },
    { caller: 'customer-catalog', scope: 'reporting.read' }
  ]) {
    const signed = await token(active.privateKey, 'service', invalid);
    await assert.rejects(() => verifier.authenticate(signed, 'insights-api', ''), rejectsStatus(403));
  }
  await assert.rejects(() => verifier.authenticate(good, 'gateway', sub), rejectsStatus(403));
});
