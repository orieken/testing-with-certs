import assert from 'node:assert/strict';
import { generateKeyPairSync, createPublicKey, sign, verify } from 'node:crypto';
import { writeFileSync } from 'node:fs';

export const issuer = 'https://isolated-jwt.test';
export const audience = 'teaching-consumer';
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
export function checkToken(token, keys, expectedIssuer, expectedAudience, now = Math.floor(Date.now()/1000)) {
  const parts = token.split('.');
  assert.equal(parts.length, 3, 'JWT segments');
  const [header, payload, signature] = parts;
  const h = JSON.parse(Buffer.from(header, 'base64url'));
  assert.equal(h.alg, 'RS256', 'algorithm');
  const key = keys.find(k => k.kid === h.kid);
  assert.ok(key, 'known key');
  assert.ok(verify('RSA-SHA256', Buffer.from(`${header}.${payload}`), createPublicKey({key, format:'jwk'}), Buffer.from(signature,'base64url')), 'signature');
  const p = JSON.parse(Buffer.from(payload, 'base64url'));
  assert.equal(p.iss, expectedIssuer, 'issuer');
  assert.ok([p.aud].flat().includes(expectedAudience), 'audience');
  assert.ok(Number.isInteger(p.exp) && p.exp > now, 'expiry');
  assert.ok(p.nbf === undefined || (Number.isInteger(p.nbf) && p.nbf <= now), 'not before');
  assert.equal(typeof p.sub, 'string', 'subject');
  return p;
}
export function altered(token) {
  const parts = token.split('.');
  const signature = Buffer.from(parts[2], 'base64url'); signature[0] ^= 1;
  parts[2] = signature.toString('base64url'); return parts.join('.');
}
export function runJwt() {
  const {privateKey, publicKey} = generateKeyPairSync('rsa', {modulusLength:2048});
  writeFileSync('/state/signer.pem', privateKey.export({type:'pkcs8',format:'pem'}), {mode:0o600});
  const key = {...publicKey.export({format:'jwk'}), kid:'ephemeral', alg:'RS256', use:'sig'};
  const now = Math.floor(Date.now()/1000);
  const claims = {iss:issuer, aud:audience, sub:'synthetic-customer', exp:now+120, iat:now, cert_identity:'synthetic-customer', realm_access:{roles:['customer']}};
  const issue = changes => {
    const body = `${encode({alg:'RS256',typ:'JWT',kid:key.kid})}.${encode({...claims,...changes})}`;
    return `${body}.${sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64url')}`;
  };
  const valid = issue({});
  const fixtures = {valid, expired:issue({exp:now-60}), wrongAudience:issue({aud:'other-consumer'}), alteredSignature:altered(valid)};
  writeFileSync('/state/tokens.json', JSON.stringify(fixtures), {mode:0o600});
  assert.equal(checkToken(valid,[key],issuer,audience).cert_identity, 'synthetic-customer');
  assert.throws(()=>checkToken(fixtures.expired,[key],issuer,audience), /expiry/);
  assert.throws(()=>checkToken(fixtures.wrongAudience,[key],issuer,audience), /audience/);
  assert.throws(()=>checkToken(fixtures.alteredSignature,[key],issuer,audience), /signature/);
  console.log('MOCK-CONSUMER FEATURE-01: valid accepted; expired, wrong audience, altered signature rejected (4/4)');
}
