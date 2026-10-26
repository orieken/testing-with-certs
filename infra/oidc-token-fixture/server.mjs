import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { timingSafeEqual } from 'node:crypto';
import { createLease, leaseStatus, isJwksLease, recordOriginal, setJwksMode } from './jwks-state.mjs';
import { upstreamIdTokenKinds, jwksCaseNames } from './cases.mjs';
import { createSigner, verifyOriginal, alterIdToken } from './tokens.mjs';
const broker = 'https://shop.magic.test:9643', ak = 'https://shop.magic.test:9743';
const providers = {
  keycloak: { token: `${broker}/realms/lesson-provider/protocol/openid-connect/token`, jwks: `${broker}/realms/lesson-provider/protocol/openid-connect/certs`, issuer: `${broker}/realms/lesson-provider`, client: 'lesson-oidc-broker' },
  authentik: { token: `${ak}/application/o/token/`, jwks: `${ak}/application/o/lesson-oidc/jwks/`, issuer: `${ak}/application/o/lesson-oidc/`, client: 'authentik-oidc-broker' },
};
const signer = createSigner(), leases = new Map();
const secret = Buffer.from(`Bearer ${readFileSync('/state/client-secret', 'utf8')}`);
function authorized(request) {
  const value = Buffer.from(request.headers.authorization ?? '');
  return value.length === secret.length && timingSafeEqual(value, secret);
}
function reply(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(JSON.stringify(value));
}
async function body(request) {
  let value = '';
  for await (const chunk of request) { value += chunk; if (value.length > 131072) throw new Error('Request bound'); }
  return value;
}
async function remote(url, options) {
  const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(10000) });
  const text = await response.text();
  if (text.length > 1048576) throw new Error('Response bound');
  return { status: response.status, value: JSON.parse(text) };
}
async function control(request, response) {
  if (!authorized(request)) return reply(response, 403, { ok: false });
  if (request.method === 'GET') return reply(response, 200, { idle: leases.size === 0 });
  const { provider, owner, action, kind, mode } = JSON.parse(await body(request));
  if (!providers[provider] || !/^[a-f0-9-]{36}$/.test(owner ?? '')) return reply(response, 400, { ok: false });
  const lease = leases.get(provider);
  if (action === 'arm') {
    if (lease || ![...upstreamIdTokenKinds, ...jwksCaseNames].includes(kind)) return reply(response, 409, { ok: false });
    leases.set(provider, createLease(owner, kind));
    return reply(response, 200, { ok: true });
  }
  if (!lease || lease.owner !== owner) return reply(response, 409, { ok: false });
  if (action === 'status') return reply(response, 200, leaseStatus(lease));
  if (action === 'jwks-mode') return reply(response, setJwksMode(lease, mode) ? 200 : 400, { ok: lease.mode === mode });
  if (action === 'release') { leases.delete(provider); return reply(response, 200, { ok: true }); }
  return reply(response, 400, { ok: false });
}
async function exchange(request, response, name) {
  const spec = providers[name], text = await body(request), form = new URLSearchParams(text);
  const headers = { 'content-type': 'application/x-www-form-urlencoded' };
  if (request.headers.authorization) headers.authorization = request.headers.authorization;
  const lease = leases.get(name);
  const result = await remote(spec.token, { method: 'POST', headers, body: text });
  if (lease && (isJwksLease(lease) || !lease.applied) && result.status === 200 && form.get('grant_type') === 'authorization_code') {
    const keys = (await remote(spec.jwks)).value.keys;
    verifyOriginal(result.value.id_token, keys, spec.issuer, spec.client);
    if (isJwksLease(lease)) recordOriginal(lease, result.value.id_token);
    else {
      result.value.id_token = alterIdToken(result.value.id_token, lease.kind, signer);
      lease.originalVerified = true; lease.applied++;
    }
  }
  reply(response, result.status, result.value);
}
async function handle(request, response) {
  if (request.url === '/health' && request.method === 'GET') return reply(response, 200, { ready: true });
  if (request.url === '/control') return control(request, response);
  const [, name, endpoint] = request.url.split('/');
  if (!providers[name]) return reply(response, 404, { ok: false });
  if (request.method === 'GET' && endpoint === 'jwks') {
    const lease = leases.get(name);
    if (isJwksLease(lease)) {
      lease.jwksRequests++;
      if (lease.mode !== 'healthy') {
        lease.jwksFailures++;
        if (lease.mode === 'unavailable') return reply(response, 503, { error: 'isolated_jwks_outage' });
        if (lease.mode === 'empty') return reply(response, 200, { keys: [] });
        response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        return response.end('{not-valid-jwks');
      }
      lease.jwksSuccesses++;
    }
    const result = await remote(providers[name].jwks);
    return reply(response, result.status, { keys: [...result.value.keys, signer.jwk] });
  }
  if (request.method === 'POST' && endpoint === 'token') return exchange(request, response, name);
  reply(response, 404, { ok: false });
}
createServer((request, response) => { handle(request, response).catch(() => reply(response, 502, { error: 'isolated_fixture_failure' })); })
  .listen(9102, '0.0.0.0');
