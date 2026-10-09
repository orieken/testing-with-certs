import { chromium, expect } from '@playwright/test';
import { createHash, createPublicKey, randomBytes, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';

const channel = process.env.LAB_BROWSER;
const username = process.env.LAB_USER;
if (!['chrome', 'msedge'].includes(channel)) throw new Error('Unsupported browser');
const identities = JSON.parse(readFileSync('/work/seed/identities.json', 'utf8'));
const selected = identities.find(user => user.username === username && user.enabled);
if (!selected) throw new Error('An enabled seed identity is required');
const shop = 'https://shop.magic.test:8443';
const issuer = 'https://auth.magic.test:9443/realms/magic-shop';

// The persistent native browser deliberately has no Playwright clientCertificates.
// Its NSS store and the brand-specific managed policy must select the certificate.
const context = await chromium.launchPersistentContext('/home/runner/profile', {
  channel, headless: false, ignoreHTTPSErrors: false, timeout: 30_000,
});
try {
  const page = context.pages()[0] ?? await context.newPage();
  const shopResponse = await page.goto(shop, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  if (shopResponse?.status() !== 200) throw new Error(`Native browser shop entry returned ${shopResponse?.status()}`);

  if (process.env.LAB_UI_FLOW === '1') {
    await page.getByRole('button', { name: 'Sign in with certificate' }).click();
    await expect(page.getByTestId('signed-in-user')).toContainText(selected.username, { timeout: 20_000 });
    const roleLabel = { customer: 'Customer', shopkeeper: 'Shopkeeper', 'shop-admin': 'Shop admin' }[selected.role];
    await expect(page.getByTestId('signed-in-user')).toContainText(roleLabel);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('button', { name: 'Sign in with certificate' })).toBeVisible({ timeout: 20_000 });
    console.log(`${channel} ${username}: native-store Vue sign-in, selected role and sign-out passed`);
  } else {

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
  const callback = new URL(page.url());
  if (callback.origin !== shop || callback.pathname !== '/callback' || callback.searchParams.get('state') !== state) {
    throw new Error(`Native certificate login did not reach shop callback: ${callback.origin}${callback.pathname}`);
  }
  const code = callback.searchParams.get('code');
  if (!code || await page.locator('input[type=password]').count()) throw new Error('Certificate-only authorization code missing');
  const response = await context.request.post(`${issuer}/protocol/openid-connect/token`, {
    form: { grant_type: 'authorization_code', client_id: 'shop-spa', code, redirect_uri: redirectUri, code_verifier: verifier },
    timeout: 10_000,
  });
  if (response.status() !== 200) throw new Error(`Native PKCE token exchange returned ${response.status()}`);
  const { access_token: token } = await response.json();
  if (typeof token !== 'string') throw new Error('Native PKCE access token missing');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Native PKCE token is not a JWT');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  const jwksResponse = await context.request.get(`${issuer}/protocol/openid-connect/certs`, { timeout: 10_000 });
  if (jwksResponse.status() !== 200) throw new Error(`JWKS returned ${jwksResponse.status()}`);
  const jwks = await jwksResponse.json();
  const key = jwks.keys?.find(candidate => candidate.kid === header.kid && candidate.kty === 'RSA');
  if (header.alg !== 'RS256' || !key || !verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key, format: 'jwk' }), Buffer.from(parts[2], 'base64url'))) {
    throw new Error('Native PKCE token signature invalid');
  }
  if (claims.iss !== issuer || claims.sub !== selected.sub || claims.cert_identity !== selected.certIdentity || claims.preferred_username !== selected.username || !claims.realm_access?.roles?.includes(selected.role)) {
    throw new Error('Native browser selected the wrong Keycloak identity');
  }
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp <= now || claims.exp - claims.iat > 120) throw new Error('Native PKCE token lifetime invalid');
  console.log(`${channel} ${username}: native NSS certificate and managed policy completed PKCE login with signed selected-user identity`);
  }
} finally {
  await context.close();
}
