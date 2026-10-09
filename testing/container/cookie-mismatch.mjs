import { chromium } from '@playwright/test';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const browserName = process.env.LAB_BROWSER;
if (!['chrome', 'msedge'].includes(browserName)) throw new Error('Unsupported browser');
const shop = 'https://shop.magic.test:8443';
const auth = 'https://auth.magic.test:9443';
const issuer = `${auth}/realms/magic-shop`;
const browser = await chromium.launch({ channel: browserName, headless: true, timeout: 30_000 });

function certificates(directory) {
  const material = { cert: readFileSync(`${directory}/cert.pem`), key: readFileSync(`${directory}/key.pem`) };
  return [{ origin: shop, ...material }, { origin: auth, ...material }];
}

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
  const final = new URL(page.url());
  return { page, code: final.searchParams.get('code'), state: final.searchParams.get('state'), expectedState: state, verifier };
}

async function exchange(context, flow) {
  if (!flow.code || flow.state !== flow.expectedState) throw new Error('Authorization code/state missing');
  const response = await context.request.post(`${issuer}/protocol/openid-connect/token`, {
    form: { grant_type: 'authorization_code', client_id: 'shop-spa',
      code: flow.code, redirect_uri: `${shop}/callback`, code_verifier: flow.verifier },
    timeout: 10_000,
  });
  if (response.status() !== 200) throw new Error(`Token exchange returned ${response.status()}`);
  const token = (await response.json()).access_token;
  if (typeof token !== 'string') throw new Error('Access token missing');
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
}

let admin;
let mismatched;
let fresh;
try {
  admin = await browser.newContext({ ignoreHTTPSErrors: false, clientCertificates: certificates('/admin') });
  const adminClaims = await exchange(admin, await authorize(admin));
  if (adminClaims.cert_identity !== '22222222-2222-4222-8222-222222222222') throw new Error('Admin fixture mapped incorrectly');
  mismatched = await browser.newContext({
    ignoreHTTPSErrors: false,
    clientCertificates: certificates('/customer'),
    storageState: await admin.storageState(),
  });
  const mismatch = await authorize(mismatched);
  if (mismatch.code) throw new Error('Saved admin cookie minted code for customer certificate');
  if (await mismatch.page.locator('input[type=password]').count()) throw new Error('Password fallback appeared');
  fresh = await browser.newContext({ ignoreHTTPSErrors: false, clientCertificates: certificates('/customer') });
  const customerClaims = await exchange(fresh, await authorize(fresh));
  if (customerClaims.cert_identity !== '11111111-1111-4111-8111-111111111111' || customerClaims.preferred_username !== 'customer-waterdeep') {
    throw new Error('Fresh customer certificate mapped incorrectly');
  }
  console.log(`${browserName}: saved admin cookies denied with customer certificate; fresh customer login mapped correctly`);
} finally {
  await fresh?.close();
  await mismatched?.close();
  await admin?.close();
  await browser.close();
}
