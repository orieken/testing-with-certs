import { readFile } from 'node:fs/promises';
import { identityKey, validateRef, validateTarget, type AuthenticationTarget, type IdentityRef } from './core.js';

async function boundedJson(response: Response): Promise<unknown> {
  const size = Number(response.headers.get('content-length'));
  if (Number.isFinite(size) && size > 1_048_576) throw new Error('Identity response too large');
  const body = await response.text();
  if (body.length > 1_048_576) throw new Error('Identity response too large');
  return body ? JSON.parse(body) as unknown : undefined;
}
function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Unexpected identity response');
  return value as Record<string, unknown>;
}
export type ServiceTokenOptions = Readonly<{ target: AuthenticationTarget; clientId: string; secretFile: string; audience: string; scopes: readonly string[]; timeoutMs?: number; fetcher?: typeof fetch }>;
export class ServiceTokenClient {
  private cached?: { token: string; expiresAt: number };
  constructor(private readonly options: ServiceTokenOptions) {
    validateTarget(options.target);
    if (!options.clientId || !options.secretFile.startsWith('/') || !options.audience || options.scopes.length > 16) throw new Error('Invalid service token configuration');
  }
  async getToken(): Promise<string> {
    if (this.cached && this.cached.expiresAt > Date.now() + 30_000) return this.cached.token;
    const secret = (await readFile(this.options.secretFile, 'utf8')).trim();
    if (!secret) throw new Error('Service secret missing');
    const response = await (this.options.fetcher ?? fetch)(`${this.options.target.issuer}/protocol/openid-connect/token`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: this.options.clientId, client_secret: secret, scope: this.options.scopes.join(' ') }),
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 10_000)
    });
    if (!response.ok) throw new Error(`Service token request failed (${response.status})`);
    const data = object(await boundedJson(response));
    if (typeof data.access_token !== 'string' || typeof data.expires_in !== 'number' || data.expires_in < 1 || data.expires_in > 86_400) throw new Error('Invalid service token response');
    const token = data.access_token;
    const segments = token.split('.');
    if (segments.length !== 3 || segments[1].length > 16_384) throw new Error('Invalid service token shape');
    const claims = object(JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8')) as unknown);
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const scopes = typeof claims.scope === 'string' ? claims.scope.split(' ') : [];
    if (claims.iss !== this.options.target.issuer || !audiences.includes(this.options.audience) ||
        !this.options.scopes.every(scope => scopes.includes(scope)) || typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) {
      throw new Error('Service token claims do not match requested capability');
    }
    // These are unverified client-side claims; the receiving service must verify the JWT signature.
    this.cached = { token, expiresAt: Math.min(claims.exp * 1000, Date.now() + data.expires_in * 1000) };
    return token;
  }
}

export type AdminOptions = Readonly<{ issuer: string; operatorTokenFile: string; namespacePrefix: string; timeoutMs?: number; fetcher?: typeof fetch }>;
export class KeycloakAdminAdapter {
  private readonly realm: string;
  constructor(private readonly options: AdminOptions) {
    const parsed = new URL(options.issuer);
    if (parsed.protocol !== 'https:' || !/^\/realms\/[a-zA-Z0-9_-]+$/.test(parsed.pathname) || options.issuer !== `${parsed.origin}${parsed.pathname}` || !options.operatorTokenFile.startsWith('/') || !/^[a-z][a-z0-9-]{0,30}-$/.test(options.namespacePrefix)) throw new Error('Invalid admin configuration');
    this.realm = parsed.pathname.slice('/realms/'.length);
  }
  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const token = (await readFile(this.options.operatorTokenFile, 'utf8')).trim();
    if (!token) throw new Error('Operator token missing');
    const response = await (this.options.fetcher ?? fetch)(`${new URL(this.options.issuer).origin}/admin/realms/${this.realm}${path}`, {
      method, headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(this.options.timeoutMs ?? 10_000)
    });
    if (!response.ok) throw new Error(`Keycloak admin request failed (${response.status})`);
    return boundedJson(response);
  }
  username(ref: IdentityRef): string { validateRef(ref); return `${this.options.namespacePrefix}${ref.namespace}-${ref.name}`; }
  async upsert(ref: IdentityRef, certIdentity: string): Promise<void> {
    const username = this.username(ref);
    if (!/^[a-zA-Z0-9._-]{1,128}$/.test(certIdentity)) throw new Error('Invalid certificate identity');
    const found = await this.request('GET', `/users?username=${encodeURIComponent(username)}&exact=true&max=2`);
    if (!Array.isArray(found) || found.length > 1) throw new Error('Ambiguous Keycloak user');
    if (found.length === 0) {
      await this.request('POST', '/users', { username, enabled: true, attributes: { cert_identity: [certIdentity] } });
      return;
    }
    const existing = object(found[0]);
    if (typeof existing.id !== 'string') throw new Error('Missing Keycloak user ID');
    const user = object(await this.request('GET', `/users/${encodeURIComponent(existing.id)}`));
    const attrs = object(user.attributes);
    if (!Array.isArray(attrs.cert_identity) || attrs.cert_identity.length !== 1 || attrs.cert_identity[0] !== certIdentity) throw new Error('Existing certificate identity differs');
  }
  async cleanupNamespace(namespace: string): Promise<number> {
    validateRef({ namespace, name: 'cleanup' });
    const prefix = `${this.options.namespacePrefix}${namespace}-`;
    const found = await this.request('GET', `/users?search=${encodeURIComponent(prefix)}&max=101`);
    if (!Array.isArray(found) || found.length > 100) throw new Error('Namespace cleanup exceeds bound');
    let count = 0;
    for (const entry of found) {
      const user = object(entry);
      if (typeof user.username !== 'string' || !user.username.startsWith(prefix) || typeof user.id !== 'string') continue;
      await this.request('DELETE', `/users/${encodeURIComponent(user.id)}`); count++;
    }
    return count;
  }
}

export function identityRequestKey(ref: IdentityRef): string { return identityKey(ref); }
