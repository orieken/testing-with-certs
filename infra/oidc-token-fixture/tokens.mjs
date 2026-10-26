import { generateKeyPairSync, randomUUID, sign, verify, createPublicKey } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { upstreamIdTokenKinds } from './cases.mjs';
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
export const decode = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url'));
export function createSigner() {
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = randomUUID();
  return { privateKey: pair.privateKey, jwk: { ...pair.publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' } };
}
export function verifyOriginal(token, keys, issuer, client) {
  const [header, payload, signature] = token.split('.');
  const metadata = JSON.parse(Buffer.from(header, 'base64url'));
  const key = keys.find(value => value.kid === metadata.kid && value.kty === 'RSA');
  if (metadata.alg !== 'RS256' || !key || !verify('RSA-SHA256', Buffer.from(`${header}.${payload}`),
    createPublicKey({ key, format: 'jwk' }), Buffer.from(signature, 'base64url'))) throw new Error('Original provider signature invalid');
  const claims = decode(token), now = Math.floor(Date.now() / 1000);
  if (claims.iss !== issuer || ![claims.aud].flat().includes(client) || claims.exp <= now ||
      typeof claims.nonce !== 'string' || !claims.nonce) throw new Error('Original provider claims invalid');
  return claims;
}
export function alterIdToken(token, kind, signer) {
  if (!upstreamIdTokenKinds.includes(kind)) throw new Error('Unknown ID-token fault');
  const original = decode(token), claims = structuredClone(original);
  if (kind === 'issuer') claims.iss = 'https://untrusted.invalid/issuer';
  if (kind === 'audience') claims.aud = 'unrelated-upstream-client';
  if (kind === 'authorized-party') claims.azp = 'unrelated-upstream-client';
  if (kind === 'expired') claims.exp = Math.floor(Date.now() / 1000) - 300;
  if (kind === 'not-yet-valid') claims.nbf = Math.floor(Date.now() / 1000) + 300;
  if (kind === 'nonce') claims.nonce = `${claims.nonce}-different`;
  if (kind === 'missing-nonce') delete claims.nonce;
  const changed = Object.keys({ ...original, ...claims }).filter(key => !isDeepStrictEqual(original[key], claims[key]));
  const expected = { issuer: 'iss', audience: 'aud', 'authorized-party': 'azp', expired: 'exp',
    'not-yet-valid': 'nbf', nonce: 'nonce', 'missing-nonce': 'nonce' }[kind];
  if (!isDeepStrictEqual(changed, expected ? [expected] : [])) throw new Error('ID-token mutation isolation failed');
  const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url'));
  const body = `${encode({ ...header, alg: 'RS256', kid: kind === 'unknown-key' ? 'unpublished-fixture-key' : signer.jwk.kid })}.${encode(claims)}`;
  const signature = sign('RSA-SHA256', Buffer.from(body), signer.privateKey);
  if (kind === 'signature') signature[0] ^= 1;
  return `${body}.${signature.toString('base64url')}`;
}
