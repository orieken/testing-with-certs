import { createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';

const issuer = 'https://auth.magic.test:9443/realms/magic-shop';
const clientId = process.env.CLIENT_ID;
const expectedAudience = process.env.EXPECT_AUDIENCE;
const expectedScope = process.env.EXPECT_SCOPE;
if (![clientId, expectedAudience, expectedScope].every(value => typeof value === 'string' && /^[a-z][a-z0-9.-]+$/.test(value))) {
  throw new Error('Expected client, audience and scope are required');
}
const secret = readFileSync('/service-secret/client-secret', 'utf8').trim();
async function json(response) {
  if (response.status !== 200) throw new Error(`Keycloak token/JWKS request returned ${response.status}`);
  const length = Number(response.headers.get('content-length') ?? '0');
  if (length > 1_048_576) throw new Error('Response exceeds size bound');
  const text = await response.text();
  if (text.length > 1_048_576) throw new Error('Response exceeds size bound');
  return JSON.parse(text);
}
const result = await json(await fetch(`${issuer}/protocol/openid-connect/token`, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: secret }),
  signal: AbortSignal.timeout(10_000),
}));
if (typeof result.access_token !== 'string') throw new Error('Service access token missing');
const parts = result.access_token.split('.');
if (parts.length !== 3) throw new Error('Service access token is not a JWT');
const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
const jwks = await json(await fetch(`${issuer}/protocol/openid-connect/certs`, { signal: AbortSignal.timeout(10_000) }));
const jwk = jwks.keys?.find(value => value.kid === header.kid && value.kty === 'RSA');
if (header.alg !== 'RS256' || !jwk) throw new Error('Service JWT signing key or algorithm invalid');
if (!verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'))) {
  throw new Error('Service JWT signature invalid');
}
const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
const scope = typeof claims.scope === 'string' ? claims.scope.split(' ') : [];
if (claims.iss !== issuer || claims.azp !== clientId || !audience.includes(expectedAudience) || !scope.includes(expectedScope)) {
  throw new Error('Service JWT audience, scope or caller mismatch');
}
const otherAudience = expectedAudience === 'catalog-api' ? 'customer-api' : 'catalog-api';
const otherScope = expectedScope === 'catalog.quote' ? 'reporting.read' : 'catalog.quote';
if (audience.includes(otherAudience) || scope.includes(otherScope) || audience.includes('insights-api')) {
  throw new Error('Service JWT has an unrelated business capability');
}
const now = Math.floor(Date.now() / 1000);
if (typeof claims.exp !== 'number' || claims.exp <= now || claims.exp - claims.iat > 120) throw new Error('Service JWT lifetime invalid');
console.log(`${clientId}: signed token has intended service capability ${expectedAudience}/${expectedScope} and no peer capability`);
