import { recordCheck } from './evidence.mjs';
import { request } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, createPublicKey, randomBytes, verify, X509Certificate } from 'node:crypto';

export const shop = 'https://shop.magic.test:8443';
const issuer = 'https://auth.magic.test:9443/realms/magic-shop';
const client = 'shop-spa-rfc8705';
export const thumbprint = directory => createHash('sha256').update(new X509Certificate(readFileSync(`${directory}/cert.pem`)).raw).digest('base64url');
const certificate = (directory, origin) => ({ origin, certPath: `${directory}/cert.pem`, keyPath: `${directory}/key.pem` });
export async function context(directory) {
  return request.newContext({ ignoreHTTPSErrors: false, timeout: 10000,
    clientCertificates: directory ? [shop, new URL(issuer).origin].map(origin => certificate(directory, origin)) : [] });
}
export async function tokenFor(directory, browser) {
  const ctx = browser ? await browser.newContext({ ignoreHTTPSErrors: false,
    clientCertificates: [shop, new URL(issuer).origin].map(origin => certificate(directory, origin)) }) : await context(directory);
  let page;
  try {
    const verifier = randomBytes(32).toString('base64url');
    const state = randomBytes(16).toString('base64url');
    const url = new URL(`${issuer}/protocol/openid-connect/auth`);
    for (const [key, value] of Object.entries({ response_type: 'code', client_id: client, redirect_uri: `${shop}/callback`, scope: 'openid profile', state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' })) url.searchParams.set(key, value);
    let callback;
    if (browser) {
      page = await ctx.newPage();
      // Redirected navigations need request observation: route handlers do not
      // reliably run again for the redirected callback URL. Suppress the shop
      // adapter so this test, not another client's SPA adapter, owns the exchange.
      await page.route('**/*', route => {
        const request = route.request();
        return request.resourceType() === 'script' && new URL(request.url()).origin === shop
          ? route.abort() : route.continue();
      });
      page.on('request', request => {
        const actual = new URL(request.url());
        if (actual.origin === shop && actual.pathname === '/callback') callback = actual;
      });
      await page.goto(url.href);
      assert.ok(callback, 'Browser must reach the registered callback');
      await page.setContent('<!doctype html><title>Certificate authorization</title><h1>Certificate authorization returned</h1><p>Test-owned callback capture. State and the private code exchange are verified by the test.</p>');
    } else {
      const authorization = await ctx.get(url.href, { maxRedirects: 0 });
      assert.equal(authorization.status(), 302, 'Real certificate authorization must succeed');
      callback = new URL(authorization.headers().location);
    }
    assert.ok(callback.origin === shop && callback.pathname === '/callback' && callback.searchParams.get('state') === state && callback.searchParams.get('code'), 'Matching authorization callback required');
    const response = await (browser ? ctx.request : ctx).post(`${issuer}/protocol/openid-connect/token`, { form: { grant_type: 'authorization_code', client_id: client, redirect_uri: `${shop}/callback`, code: callback.searchParams.get('code'), code_verifier: verifier } });
    assert.equal(response.status(), 200, 'Real PKCE exchange must succeed');
    const token = (await response.json()).access_token;
    assert.ok(typeof token === 'string', 'Access token required');
    const [head, body, signature] = token.split('.');
    const header = JSON.parse(Buffer.from(head, 'base64url'));
    const jwks = await (browser ? ctx.request : ctx).get(`${issuer}/protocol/openid-connect/certs`);
    assert.equal(jwks.status(), 200);
    const key = (await jwks.json()).keys.find(key => key.kid === header.kid && key.kty === 'RSA');
    assert.ok(header.alg === 'RS256' && key, 'Expected trusted signing key');
    assert.ok(verify('RSA-SHA256', Buffer.from(`${head}.${body}`), createPublicKey({ key, format: 'jwk' }), Buffer.from(signature, 'base64url')), 'Real provider signature required');
    const claims = JSON.parse(Buffer.from(body, 'base64url'));
    assert.ok(claims.iss === issuer && claims.azp === client && claims.exp > Date.now() / 1000, 'Expected valid issuer, client and expiry');
    assert.ok(['catalog-api', 'customer-api', 'insights-api'].every(audience => claims.aud.includes(audience)), 'Expected API audiences');
    assert.ok(claims.cnf?.['x5t#S256'] === thumbprint(directory), 'Signed token must bind the exact DER leaf');
    recordCheck('signed-binding', 'verified', 'verified');
    return { token, claims, context: browser ? ctx : undefined, page };
  } catch (error) {
    if (browser) await ctx.close();
    throw error;
  } finally { if (!browser) await ctx.dispose(); }
}
const paths = ['/api/catalog/items', '/api/customer/me', '/api/insights/regions'];
export async function api(directory, token, status, spoof = false) {
  const ctx = await context(directory);
  try {
    for (const path of paths) {
      const response = await ctx.get(`${shop}${path}`, { headers: { authorization: `Bearer ${token}`,
        ...(spoof ? { 'x-cert-thumbprint': Buffer.from(thumbprint('/identity-admin'), 'base64url').toString('base64'), 'x-cert-identity': '22222222-2222-4222-8222-222222222222' } : {}) } });
      // Do not put bearer values or response bodies in assertion diagnostics.
      recordCheck(path, response.status(), status);
      assert.equal(response.status(), status, `Expected resource result at ${path}`);
    }
  } finally { await ctx.dispose(); }
}
