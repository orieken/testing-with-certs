import { createHash, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, request, test, type APIRequestContext } from '@playwright/test';

const shop = 'https://shop.magic.test:8443';
const auth = 'https://auth.magic.test:9443';
const issuer = `${auth}/realms/magic-shop`;
type Identity = Readonly<{ dir: string; sub: string }>;
const waterdeep: Identity = { dir: '/identity-customer', sub: '10101010-1010-4010-8010-101010101010' };
const baldur: Identity = { dir: '/identity-second-customer', sub: '20202020-2020-4020-8020-202020202020' };
const shopkeeper: Identity = { dir: '/identity-shopkeeper', sub: '40404040-4040-4040-8040-404040404040' };
const certificate = (identity: Identity, origin: string) => ({ origin, certPath: `${identity.dir}/cert.pem`, keyPath: `${identity.dir}/key.pem` });

async function tokensFor(identity: Identity): Promise<{ access: string; id: string }> {
  const context = await request.newContext({ clientCertificates: [certificate(identity, shop), certificate(identity, auth)], ignoreHTTPSErrors: false, timeout: 10_000 });
  try {
    const verifier = randomBytes(32).toString('base64url');
    const state = randomBytes(16).toString('base64url');
    const url = new URL(`${issuer}/protocol/openid-connect/auth`);
    for (const [key, value] of Object.entries({ response_type: 'code', client_id: 'shop-spa', redirect_uri: `${shop}/callback`, scope: 'openid profile', code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', state })) url.searchParams.set(key, value);
    const authorize = await context.get(url.href, { maxRedirects: 0 });
    const location = authorize.headers().location;
    if (authorize.status() !== 302 || !location) throw new Error(`Certificate authorization returned ${authorize.status()}`);
    const callback = new URL(location, auth);
    const code = callback.searchParams.get('code');
    if (callback.origin !== shop || callback.pathname !== '/callback' || callback.searchParams.get('state') !== state || !code) throw new Error('Certificate authorization did not return a matching code');
    const exchange = await context.post(`${issuer}/protocol/openid-connect/token`, { form: { grant_type: 'authorization_code', client_id: 'shop-spa', code, redirect_uri: `${shop}/callback`, code_verifier: verifier } });
    if (exchange.status() !== 200) throw new Error(`Token exchange returned ${exchange.status()}`);
    const tokens = await exchange.json() as { access_token?: string; id_token?: string };
    if (!tokens.access_token || !tokens.id_token) throw new Error('Selected tokens missing');
    return { access: tokens.access_token, id: tokens.id_token };
  } finally { await context.dispose(); }
}
async function tokenFor(identity: Identity): Promise<string> { return (await tokensFor(identity)).access; }

async function customerContext(identity: Identity, token: string, headers: Record<string, string> = {}): Promise<APIRequestContext> {
  return request.newContext({ baseURL: shop, clientCertificates: [certificate(identity, shop)], extraHTTPHeaders: { authorization: `Bearer ${token}`, ...headers }, ignoreHTTPSErrors: false, timeout: 10_000 });
}

test('AUTH-03 a browser without a client certificate cannot enter the shop', async () => {
  const context = await request.newContext({ baseURL: shop, ignoreHTTPSErrors: false, timeout: 5_000 });
  try { await expect(context.get('/')).rejects.toThrow(); } finally { await context.dispose(); }
});

test('TRUST-01 wrong server hostname fails with an otherwise valid user certificate', async () => {
  const origin = 'https://gateway:8443';
  const context = await request.newContext({ baseURL: origin, clientCertificates: [certificate(waterdeep, origin)], ignoreHTTPSErrors: false, timeout: 5_000 });
  try { await expect(context.get('/')).rejects.toThrow(); } finally { await context.dispose(); }
});

test('TRUST-01 removing the private server CA fails verified shop TLS', async () => {
  const run = promisify(execFile);
  const result = await run(process.execPath, ['/work/testing/api/security/untrusted-server-probe.mjs'], {
    env: { ...process.env, NODE_EXTRA_CA_CERTS: '' }, timeout: 10_000, maxBuffer: 16_384
  });
  expect(result.stdout).toContain('Untrusted shop server CA rejected');
});

test('JWT-01 a signed ID token is not accepted as an API access token', async () => {
  const tokens = await tokensFor(waterdeep);
  const context = await customerContext(waterdeep, tokens.id);
  try { expect((await context.get('/api/customer/me')).status()).toBe(401); }
  finally { await context.dispose(); }
});

test('JWT-01 malformed, unsigned and unknown-key bearer values fail closed', async () => {
  const valid = await tokenFor(waterdeep);
  const parts = valid.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) throw new Error('Unexpected issued access-token shape');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as Record<string, unknown>;
  const forgedHeader = (changes: Record<string, unknown>) => `${Buffer.from(JSON.stringify({ ...header, ...changes })).toString('base64url')}.${parts[1]}.${parts[2]}`;
  const values = [
    { name: 'missing', authorization: undefined },
    { name: 'truncated', authorization: 'Bearer abc.def' },
    { name: 'unsigned', authorization: `Bearer ${forgedHeader({ alg: 'none' })}` },
    { name: 'unknown signing key', authorization: `Bearer ${forgedHeader({ kid: 'missing-teaching-key' })}` }
  ];
  for (const value of values) {
    const context = await request.newContext({ baseURL: shop, clientCertificates: [certificate(waterdeep, shop)], extraHTTPHeaders: value.authorization ? { authorization: value.authorization } : {}, ignoreHTTPSErrors: false, timeout: 10_000 });
    try {
      for (const path of ['/api/catalog/items', '/api/customer/me', '/api/insights/regions']) {
        expect((await context.get(path)).status(), `${value.name} at ${path}`).toBe(401);
      }
    } finally { await context.dispose(); }
  }
});

test('EDGE-01 spoofed identity headers cannot turn a customer into an administrator', async () => {
  const token = await tokenFor(waterdeep);
  const context = await customerContext(waterdeep, token, {
    'x-forwarded-client-cert': 'CN=22222222-2222-4222-8222-222222222222',
    'x-ssl-client-subject': 'CN=22222222-2222-4222-8222-222222222222',
    'x-client-cert-identity': '22222222-2222-4222-8222-222222222222',
    'x-user': 'shop-admin'
  });
  try {
    expect((await context.get('/api/customer/admin/users')).status()).toBe(403);
    expect((await context.get('/api/insights/sales?from=2026-09-01T00%3A00%3A00Z&to=2026-10-01T00%3A00%3A00Z')).status()).toBe(403);
  } finally { await context.dispose(); }
});

test('EDGE-02 human certificate cannot bypass gateway into private service origins', async () => {
  const token = await tokenFor(waterdeep);
  const publicContext = await customerContext(waterdeep, token);
  try { expect((await publicContext.get('/internal/reporting/orders')).status()).toBe(404); }
  finally { await publicContext.dispose(); }
  for (const origin of ['https://customer-api:8443', 'https://catalog-api:8443']) {
    const direct = await request.newContext({ baseURL: origin, clientCertificates: [certificate(waterdeep, origin)], extraHTTPHeaders: { authorization: `Bearer ${token}` }, ignoreHTTPSErrors: false, timeout: 5_000 });
    try { await expect(direct.get('/internal/openapi.json')).rejects.toThrow(); }
    finally { await direct.dispose(); }
  }
});

test('OPS-02 two fresh certificate contexts retain separate customer identities in parallel', async () => {
  const [firstToken, secondToken] = await Promise.all([tokenFor(waterdeep), tokenFor(baldur)]);
  const [first, second] = await Promise.all([customerContext(waterdeep, firstToken), customerContext(baldur, secondToken)]);
  try {
    const [firstProfile, secondProfile] = await Promise.all([first.get('/api/customer/me'), second.get('/api/customer/me')]);
    expect(firstProfile.status()).toBe(200);
    expect(secondProfile.status()).toBe(200);
    expect((await firstProfile.json() as { sub: string }).sub).toBe(waterdeep.sub);
    expect((await secondProfile.json() as { sub: string }).sub).toBe(baldur.sub);
  } finally { await Promise.all([first.dispose(), second.dispose()]); }
});

test('ROLE-02 a second customer cannot read the first customer order', async () => {
  const token = await tokenFor(baldur);
  const context = await customerContext(baldur, token);
  try { expect((await context.get('/api/customer/orders/order-001')).status()).toBe(404); }
  finally { await context.dispose(); }
});

test('ROLE-02 list, detail, profile and widgets expose only the certificate-bound customer', async () => {
  const [waterdeepToken, baldurToken] = await Promise.all([tokenFor(waterdeep), tokenFor(baldur)]);
  const [first, second] = await Promise.all([customerContext(waterdeep, waterdeepToken), customerContext(baldur, baldurToken)]);
  try {
    for (const [context, own, other, ownOrder, otherOrder] of [
      [first, waterdeep.sub, baldur.sub, 'order-001', 'order-003'],
      [second, baldur.sub, waterdeep.sub, 'order-003', 'order-001']
    ] as const) {
      const profile = await context.get('/api/customer/me');
      expect(profile.status()).toBe(200);
      expect(await profile.json()).toMatchObject({ sub: own });
      const widgets = await context.get('/api/customer/me/widgets');
      expect(widgets.status()).toBe(200);
      expect(JSON.stringify(await widgets.json())).not.toContain(other);
      const detail = await context.get(`/api/customer/orders/${ownOrder}`);
      expect(detail.status()).toBe(200);
      expect(await detail.json()).toMatchObject({ ownerSub: own });
      expect((await context.get(`/api/customer/orders/${otherOrder}`)).status()).toBe(404);
      let cursor: string | null = null;
      for (let page = 0; page < 20; page += 1) {
        const list = await context.get(`/api/customer/orders?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
        expect(list.status()).toBe(200);
        const body = await list.json() as { items: Array<{ ownerSub: string }>; nextCursor: string | null };
        expect(body.items.every(order => order.ownerSub === own)).toBe(true);
        expect(JSON.stringify(body)).not.toContain(other);
        cursor = body.nextCursor;
        if (!cursor) break;
        if (page === 19) throw new Error('Order pagination did not terminate within 400 orders');
      }
      for (const path of ['/api/customer/admin/users', '/api/customer/admin/orders']) {
        expect((await context.get(path)).status()).toBe(403);
      }
    }
  } finally { await Promise.all([first.dispose(), second.dispose()]); }
});

test('AUTH-10 ROLE-02 customer credentials cannot select another profile or widget layout', async () => {
  const [waterdeepToken, baldurToken] = await Promise.all([tokenFor(waterdeep), tokenFor(baldur)]);
  const [first, second, mismatch] = await Promise.all([
    customerContext(waterdeep, waterdeepToken), customerContext(baldur, baldurToken), customerContext(waterdeep, baldurToken)
  ]);
  try {
    for (const path of ['/api/catalog/items', '/api/customer/me', '/api/insights/regions']) {
      expect((await mismatch.get(path)).status(), `certificate/token mismatch at ${path}`).toBe(403);
    }
    const [firstProfile, secondProfile, firstWidgets, secondWidgets] = await Promise.all([
      first.get('/api/customer/me'), second.get('/api/customer/me'),
      first.get('/api/customer/me/widgets'), second.get('/api/customer/me/widgets')
    ]);
    expect(firstProfile.status()).toBe(200);
    expect(secondProfile.status()).toBe(200);
    expect((await firstProfile.json() as { sub: string }).sub).toBe(waterdeep.sub);
    expect((await secondProfile.json() as { sub: string }).sub).toBe(baldur.sub);
    expect(firstWidgets.status()).toBe(200);
    expect(secondWidgets.status()).toBe(200);
    for (const path of [
      `/api/customer/users/${waterdeep.sub}`, `/api/customer/users/${waterdeep.sub}/widgets`,
      `/api/customer/me/${waterdeep.sub}`, `/api/customer/me/widgets/${waterdeep.sub}`
    ]) expect((await second.get(path)).status(), `unowned route ${path}`).toBe(404);
  } finally { await Promise.all([first.dispose(), second.dispose(), mismatch.dispose()]); }
});

test('ROLE-03 shopkeeper creates and archives an item while a customer write is forbidden', async () => {
  const [keeperToken, customerToken] = await Promise.all([tokenFor(shopkeeper), tokenFor(waterdeep)]);
  const [keeper, customer] = await Promise.all([customerContext(shopkeeper, keeperToken), customerContext(waterdeep, customerToken)]);
  const item = { name: `Teaching Role Item ${randomBytes(5).toString('hex')}`, description: 'Synthetic role-bound item', rarity: 'Common', image: '/images/wand-embers.png', priceCopper: 1234 };
  try {
    expect((await customer.post('/api/catalog/items', { data: item })).status()).toBe(403);
    const created = await keeper.post('/api/catalog/items', { data: item });
    expect(created.status()).toBe(201);
    const id = (await created.json() as { id: string }).id;
    expect(id).toBeTruthy();
    expect((await keeper.delete(`/api/catalog/items/${id}`)).status()).toBe(204);
  } finally { await Promise.all([keeper.dispose(), customer.dispose()]); }
});
