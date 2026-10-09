import { createLocalJWKSet, jwtVerify, type JSONWebKeySet, type JWTPayload } from 'jose';
import { readFileSync } from 'node:fs';
import { requestJSON } from './network.js';
import { validSub, type Role } from './domain.js';

export const issuer = 'https://auth.magic.test:9443/realms/magic-shop';
const jwks = new URL(`${issuer}/protocol/openid-connect/certs`);
interface Identity { sub: string; role: Role | null; service: boolean }
export class AuthFailure extends Error { constructor(public readonly status: 401 | 403) { super(status === 401 ? 'invalid_token' : 'forbidden'); } }
function headerKid(raw: string): string {
  const part = raw.split('.')[0];
  if (!part) throw new AuthFailure(401);
  const value = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as unknown;
  if (!value || typeof value !== 'object' || !('kid' in value) || typeof value.kid !== 'string' || value.kid.length < 1 || value.kid.length > 128) throw new AuthFailure(401);
  return value.kid;
}
export class AccessTokenVerifier {
  private keys: ReturnType<typeof createLocalJWKSet> | null = null;
  private until = 0;
  private missingKid = '';
  private missingUntil = 0;
  constructor(private readonly loadKeys: () => Promise<JSONWebKeySet>) {}
  private async refresh(): Promise<void> {
    const source = await this.loadKeys();
    if (!Array.isArray(source.keys) || source.keys.length > 20 || source.keys.length < 1) throw new Error('JWKS unavailable');
    const selected = source.keys.filter(key => key !== null && typeof key === 'object' && key.kty === 'RSA' && typeof key.kid === 'string' && key.alg === 'RS256');
    if (selected.length < 1) throw new Error('JWKS has no supported signing keys');
    this.keys = createLocalJWKSet({ keys: selected });
    this.until = Date.now() + 300_000;
  }
  private async claims(raw: string): Promise<JWTPayload> {
    if (raw.length < 20 || raw.length > 16_384) throw new AuthFailure(401);
    let kid: string;
    try { kid = headerKid(raw); } catch { throw new AuthFailure(401); }
    if (!this.keys || Date.now() >= this.until) { try { await this.refresh(); } catch { throw new AuthFailure(401); } }
    try { return (await jwtVerify(raw, this.keys!, { issuer, audience: 'customer-api', algorithms: ['RS256'], requiredClaims: ['exp', 'iat'] })).payload; }
    catch (error) {
      if (error instanceof Error && error.name === 'JWKSNoMatchingKey' && (kid !== this.missingKid || Date.now() >= this.missingUntil)) {
        try { await this.refresh(); this.missingKid = kid; this.missingUntil = Date.now() + 5000; return (await jwtVerify(raw, this.keys!, { issuer, audience: 'customer-api', algorithms: ['RS256'], requiredClaims: ['exp', 'iat'] })).payload; }
        catch { throw new AuthFailure(401); }
      }
      throw new AuthFailure(401);
    }
  }
  async authenticate(raw: string, caller: string, certificateIdentity: string): Promise<Identity> {
  const value = await this.claims(raw);
  if (value.typ !== 'Bearer') throw new AuthFailure(403);
  if (caller === 'gateway') {
    if (value.azp !== 'shop-spa' || typeof value.cert_identity !== 'string' || value.cert_identity !== certificateIdentity || !validSub(value.sub)) throw new AuthFailure(403);
    const access = value.realm_access;
    const roles = access && typeof access === 'object' && 'roles' in access ? access.roles : null;
    if (!Array.isArray(roles)) throw new AuthFailure(403);
    const role: Role | undefined = roles.includes('shop-admin') ? 'shop-admin' : roles.includes('shopkeeper') ? 'shopkeeper' : roles.includes('customer') ? 'customer' : undefined;
    if (!role) throw new AuthFailure(403);
    return { sub: value.sub, role, service: false };
  }
  if (caller === 'insights-api') {
    if (value.azp !== 'insights-reporting' || value.cert_identity !== undefined || typeof value.scope !== 'string' || !value.scope.split(/\s+/).includes('reporting.read')) throw new AuthFailure(403);
    return { sub: '', role: null, service: true };
  }
  throw new AuthFailure(403);
  }
}
const verifier = new AccessTokenVerifier(async () => {
  const response = await requestJSON(jwks, 'GET');
  if (response.status !== 200 || !response.body || typeof response.body !== 'object' || !('keys' in response.body) || !Array.isArray(response.body.keys)) throw new Error('JWKS unavailable');
  return response.body as JSONWebKeySet;
});
export async function authenticate(raw: string, caller: string, certificateIdentity: string): Promise<Identity> {
  return verifier.authenticate(raw, caller, certificateIdentity);
}
export async function catalogQuote(lines: Array<{ itemId: string; quantity: number }>): Promise<{ status: number; body: unknown }> {
  const secret = readFileSync('/service-secret/client-secret', 'utf8').trim();
  if (!secret) throw new Error('catalog service credential missing');
  const form = new URLSearchParams({ grant_type: 'client_credentials', client_id: 'customer-catalog', client_secret: secret, scope: 'catalog.quote' }).toString();
  const token = await requestJSON(new URL(`${issuer}/protocol/openid-connect/token`), 'POST', form,
    { 'content-type': 'application/x-www-form-urlencoded' });
  if (token.status !== 200 || !token.body || typeof token.body !== 'object' || !('access_token' in token.body) || typeof token.body.access_token !== 'string') throw new Error('catalog service token unavailable');
  return requestJSON(new URL('https://catalog-api:8443/internal/catalog/quotes'), 'POST', JSON.stringify({ lines }), { authorization: `Bearer ${token.body.access_token}` }, true);
}
