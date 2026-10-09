import { chromium } from '@playwright/test';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const browserName = process.env.LAB_BROWSER;
if (!['chrome', 'msedge'].includes(browserName)) throw new Error('Unsupported browser');
const auth = 'https://auth.magic.test:9443';
const shop = 'https://shop.magic.test:8443';
const issuer = `${auth}/realms/magic-shop`;
const userId = '30303030-3030-4030-8030-303030303030';
const browser = await chromium.launch({ channel: browserName, headless: true, timeout: 30_000 });
const cert = { cert: readFileSync('/identity/cert.pem'), key: readFileSync('/identity/key.pem') };
const options = { ignoreHTTPSErrors: false, clientCertificates: [{ origin: shop, ...cert }, { origin: auth, ...cert }] };

async function authorize(context) {
  const verifier = randomBytes(32).toString('base64url');
  const state = randomBytes(16).toString('base64url');
  const url = new URL(`${issuer}/protocol/openid-connect/auth`);
  for (const [key, value] of Object.entries({
    response_type: 'code', client_id: 'shop-spa', redirect_uri: `${shop}/callback`,
    scope: 'openid profile', code_challenge_method: 'S256',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'), state,
  })) url.searchParams.set(key, value);
  const page = await context.newPage();
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  const callback = new URL(page.url());
  return { page, code: callback.searchParams.get('code'), state: callback.searchParams.get('state'), expectedState: state, verifier };
}

let initial;
let fresh;
try {
  initial = await browser.newContext(options);
  const flow = await authorize(initial);
  if (!flow.code || flow.state !== flow.expectedState) throw new Error('Initial certificate login failed');
  const tokensResponse = await initial.request.post(`${issuer}/protocol/openid-connect/token`, {
    form: { grant_type: 'authorization_code', client_id: 'shop-spa', code: flow.code,
      redirect_uri: `${shop}/callback`, code_verifier: flow.verifier }, timeout: 10_000,
  });
  if (tokensResponse.status() !== 200) throw new Error('Initial token exchange failed');
  const tokens = await tokensResponse.json();
  if (typeof tokens.access_token !== 'string' || typeof tokens.refresh_token !== 'string') throw new Error('Tokens missing');
  const access = JSON.parse(Buffer.from(tokens.access_token.split('.')[1], 'base64url').toString());
  if (access.sub !== userId || access.cert_identity !== '77777777-7777-4777-8777-777777777777') throw new Error('Initial identity mismatch');
  const remaining = access.exp - Math.floor(Date.now() / 1000);
  if (remaining < 1 || remaining > 120) throw new Error('Residual access token bound invalid');

  const adminSecret = readFileSync('/secrets/admin/client-secret', 'utf8').trim();
  const adminResponse = await fetch(`${auth}/realms/master/protocol/openid-connect/token`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: 'lab-bootstrap', client_secret: adminSecret }),
    signal: AbortSignal.timeout(10_000),
  });
  if (adminResponse.status !== 200) throw new Error('Operator authentication failed');
  const adminToken = (await adminResponse.json()).access_token;
  if (typeof adminToken !== 'string') throw new Error('Operator token missing');
  const headers = { authorization: `Bearer ${adminToken}` };
  const disabled = await fetch(`${auth}/admin/realms/magic-shop/users/${userId}`, {
    method: 'PUT', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ enabled: false }), signal: AbortSignal.timeout(10_000),
  });
  if (disabled.status !== 204) throw new Error(`Disable returned ${disabled.status}`);
  const logout = await fetch(`${auth}/admin/realms/magic-shop/users/${userId}/logout`, {
    method: 'POST', headers, signal: AbortSignal.timeout(10_000),
  });
  if (logout.status !== 204) throw new Error(`Session termination returned ${logout.status}`);

  const refresh = await initial.request.post(`${issuer}/protocol/openid-connect/token`, {
    form: { grant_type: 'refresh_token', client_id: 'shop-spa', refresh_token: tokens.refresh_token }, timeout: 10_000,
  });
  if (refresh.status() === 200) throw new Error('Disabled user refreshed an existing session');
  fresh = await browser.newContext(options);
  const next = await authorize(fresh);
  if (next.code || await next.page.locator('input[type=password]').count()) throw new Error('Disabled user reauthenticated or received password fallback');
  console.log(`${browserName}: disable terminated sessions, refresh failed, fresh login denied; existing JWT expires within ${remaining}s`);
} finally {
  await fresh?.close();
  await initial?.close();
  await browser.close();
}
