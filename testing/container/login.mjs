import { chromium } from '@playwright/test';
import { createHash, createPublicKey, randomBytes, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';

const browserName = process.env.LAB_BROWSER;
const selected = process.env.LAB_USER;
if (!['chrome', 'msedge'].includes(browserName)) throw new Error('Unsupported browser');
const identities = JSON.parse(readFileSync('/work/seed/identities.json', 'utf8'));
const user = identities.find(value => value.username === selected) ??
  (selected === 'unknown-user' ? { username: selected, enabled: false } : undefined);
if (!user) throw new Error('Selected identity is not provisioned');
const shop = 'https://shop.magic.test:8443';
const auth = 'https://auth.magic.test:9443';
const issuer = `${auth}/realms/magic-shop`;

async function authenticate(browser) {
  const certificate = { cert: readFileSync('/identity/cert.pem'), key: readFileSync('/identity/key.pem') };
  const context = await browser.newContext({
    ignoreHTTPSErrors: false,
    clientCertificates: [
      { origin: shop, ...certificate },
      { origin: auth, ...certificate },
    ],
  });
  const page = await context.newPage();
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(16).toString('base64url');
  const redirectUri = `${shop}/callback`;
  const url = new URL(`${issuer}/protocol/openid-connect/auth`);
  for (const [name, value] of Object.entries({
    response_type: 'code', client_id: 'shop-spa', redirect_uri: redirectUri,
    scope: 'openid profile', code_challenge: challenge,
    code_challenge_method: 'S256', state,
  })) url.searchParams.set(name, value);
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  return { context, page, verifier, redirectUri, state };
}

async function verifyToken(context, token, user) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Access token is not a JWT');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('Unexpected signing algorithm');
  const response = await context.request.get(`${issuer}/protocol/openid-connect/certs`, { timeout: 10_000 });
  if (response.status() !== 200) throw new Error(`JWKS fetch returned ${response.status()}`);
  const jwks = await response.json();
  const key = jwks.keys?.find(value => value.kid === header.kid && value.kty === 'RSA');
  if (!key) throw new Error('Signing key not in JWKS');
  const valid = verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
  if (!valid) throw new Error('JWT signature invalid');
  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== issuer || claims.typ !== 'Bearer' || claims.cert_identity !== user.certIdentity || claims.sub !== user.sub || claims.preferred_username !== user.username) {
    throw new Error('User token identity mapping failed');
  }
  if (!['catalog-api', 'customer-api', 'insights-api'].every(audience => audiences.includes(audience))) {
    throw new Error('Missing API audience');
  }
  if (typeof claims.exp !== 'number' || typeof claims.iat !== 'number' || claims.exp <= now || claims.exp - claims.iat > 120) {
    throw new Error('Token lifetime invalid');
  }
  if (!Array.isArray(claims.realm_access?.roles) || !claims.realm_access.roles.includes(user.role)) {
    throw new Error('User role missing');
  }
}

const browser = await chromium.launch({ channel: browserName, headless: true, timeout: 30_000 });
let context;
try {
  const flow = await authenticate(browser);
  context = flow.context;
  const callback = new URL(flow.page.url());
  if (user.enabled && process.env.LAB_EXPECT_REVOKED !== '1') {
    if (callback.origin !== shop || callback.pathname !== '/callback' || callback.searchParams.get('state') !== flow.state) {
      throw new Error(`Authorization did not return to shop for ${selected}: ${callback.origin}${callback.pathname}`);
    }
    const code = callback.searchParams.get('code');
    if (!code) throw new Error('Authorization code missing');
    const tokenResponse = await context.request.post(`${issuer}/protocol/openid-connect/token`, {
      form: { grant_type: 'authorization_code', client_id: 'shop-spa', code, redirect_uri: flow.redirectUri, code_verifier: flow.verifier },
      timeout: 10_000,
    });
    if (tokenResponse.status() !== 200) throw new Error(`Token exchange returned ${tokenResponse.status()}`);
    const result = await tokenResponse.json();
    if (typeof result.access_token !== 'string') throw new Error('Access token missing');
    await verifyToken(context, result.access_token, user);
    if (await flow.page.locator('input[type=password]').count()) throw new Error('Password input appeared');
    console.log(`${browserName} ${selected}: certificate-only PKCE login, signed identity, audiences and role passed`);
  } else {
    if (callback.searchParams.has('code')) throw new Error('Rejected certificate received an authorization code');
    const body = (await flow.page.locator('body').innerText()).toLowerCase();
    if (!/invalid user|authentication failed|certificate|account is disabled/.test(body)) throw new Error('Rejected certificate did not show authentication failure');
    if (await flow.page.locator('input[type=password]').count()) throw new Error('Password fallback appeared');
    console.log(`${browserName} ${selected}: unmapped or disabled certificate received no code or password fallback`);
  }
} finally {
  await context?.close();
  await browser.close();
}
