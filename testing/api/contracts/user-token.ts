import { createHash, randomBytes } from 'node:crypto';
import { request } from '@playwright/test';
const shop = 'https://shop.magic.test:8443';
const auth = 'https://auth.magic.test:9443';
const issuer = `${auth}/realms/magic-shop`;
export async function userToken(cert: { certificatePath: string; privateKeyPath: string }): Promise<string> {
  const context = await request.newContext({ clientCertificates: [
    { origin: shop, certPath: cert.certificatePath, keyPath: cert.privateKeyPath },
    { origin: auth, certPath: cert.certificatePath, keyPath: cert.privateKeyPath }
  ], ignoreHTTPSErrors: false, timeout: 10_000 });
  try {
    const verifier = randomBytes(32).toString('base64url'); const state = randomBytes(16).toString('base64url');
    const url = new URL(`${issuer}/protocol/openid-connect/auth`);
    for (const [key, value] of Object.entries({ response_type: 'code', client_id: 'shop-spa', redirect_uri: `${shop}/callback`, scope: 'openid profile', code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', state })) url.searchParams.set(key, value);
    const response = await context.get(url.href, { maxRedirects: 0 });
    if (response.status() !== 302 || !response.headers().location) throw new Error(`Certificate authorization returned ${response.status()}`);
    const callback = new URL(response.headers().location!, auth); const code = callback.searchParams.get('code');
    if (callback.origin !== shop || callback.pathname !== '/callback' || callback.searchParams.get('state') !== state || !code) throw new Error('Certificate authorization returned an unexpected callback');
    const token = await context.post(`${issuer}/protocol/openid-connect/token`, { form: { grant_type: 'authorization_code', client_id: 'shop-spa', code, redirect_uri: `${shop}/callback`, code_verifier: verifier } });
    if (token.status() !== 200) throw new Error(`Code exchange returned ${token.status()}`);
    const value = await token.json() as { access_token?: string }; if (!value.access_token) throw new Error('Access token missing');
    return value.access_token;
  } finally { await context.dispose(); }
}
