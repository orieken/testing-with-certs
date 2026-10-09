import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { request, test, expect, type APIRequestContext } from '@playwright/test';
import { ServiceTokenClient } from 'saturday-keycloak-prototype';
import { assertContractResponse, assertExpectedSpec, createContractContext } from './fixtures.js';
import { validateJsonRequest } from './validator.js';

const shop = 'https://shop.magic.test:8443';
const auth = 'https://auth.magic.test:9443';
const issuer = `${auth}/realms/magic-shop`;
const customerCert = { certificatePath: '/identity-customer/cert.pem', privateKeyPath: '/identity-customer/key.pem' };
const adminCert = { certificatePath: '/identity-admin/cert.pem', privateKeyPath: '/identity-admin/key.pem' };

async function userToken(cert: typeof customerCert): Promise<string> {
  const context = await request.newContext({
    clientCertificates: [
      { origin: shop, certPath: cert.certificatePath, keyPath: cert.privateKeyPath },
      { origin: auth, certPath: cert.certificatePath, keyPath: cert.privateKeyPath }
    ], ignoreHTTPSErrors: false, timeout: 10_000
  });
  try {
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const state = randomBytes(16).toString('base64url');
    const redirect = `${shop}/callback`;
    const url = new URL(`${issuer}/protocol/openid-connect/auth`);
    for (const [key, value] of Object.entries({ response_type: 'code', client_id: 'shop-spa', redirect_uri: redirect, scope: 'openid profile', code_challenge: challenge, code_challenge_method: 'S256', state })) url.searchParams.set(key, value);
    const response = await context.get(url.href, { maxRedirects: 0 });
    const location = response.headers().location;
    if (response.status() !== 302 || !location) throw new Error(`Certificate authorization returned ${response.status()}`);
    const callback = new URL(location, auth);
    const code = callback.searchParams.get('code');
    if (callback.origin !== shop || callback.pathname !== '/callback' || callback.searchParams.get('state') !== state || !code) throw new Error('Certificate authorization did not return a matching code');
    const token = await context.post(`${issuer}/protocol/openid-connect/token`, { form: { grant_type: 'authorization_code', client_id: 'shop-spa', code, redirect_uri: redirect, code_verifier: verifier } });
    if (token.status() !== 200) throw new Error(`Code exchange returned ${token.status()}`);
    const value = await token.json() as { access_token?: string };
    if (!value.access_token) throw new Error('Access token missing');
    return value.access_token;
  } finally { await context.dispose(); }
}
async function serviceToken(): Promise<string> {
  return new ServiceTokenClient({ target: { issuer, origins: [auth] }, clientId: 'customer-catalog', secretFile: '/service-secret/client-secret', audience: 'catalog-api', scopes: ['catalog.quote'] }).getToken();
}
async function publicContext(cert: typeof customerCert): Promise<APIRequestContext> {
  return createContractContext({ origin: shop, ...cert, accessToken: await userToken(cert) });
}
async function privateContext(): Promise<APIRequestContext> {
  return createContractContext({ origin: 'https://catalog-api:8443', certificatePath: '/service-identity/cert.pem', privateKeyPath: '/service-identity/key.pem', accessToken: await serviceToken() });
}

test('catalog list and authenticated spec match the expected OpenAPI artifact', async () => {
  const customer = await publicContext(customerCert);
  const service = await privateContext();
  try {
    const response = await customer.get('/api/catalog/items?limit=2');
    await assertContractResponse('catalog', 'listItems', 200, response);
    const data = await response.json() as { items: Array<{ id: string }>; nextCursor: string | null };
    expect(data.items).toHaveLength(2);
    expect(data.nextCursor).toBeTruthy();
    const next = await customer.get(`/api/catalog/items?limit=2&cursor=${encodeURIComponent(data.nextCursor!)}`);
    await assertContractResponse('catalog', 'listItems', 200, next);
    const page = await next.json() as { items: Array<{ id: string }> };
    expect(page.items[0].id > data.items[1].id).toBe(true);
    const searched = await customer.get('/api/catalog/items?search=Wand');
    await assertContractResponse('catalog', 'listItems', 200, searched);
    expect((await searched.json() as { items: Array<{ name: string }> }).items.every(item => item.name.toLowerCase().includes('wand'))).toBe(true);
    const unicodeSearch = await customer.get(`/api/catalog/items?search=${encodeURIComponent('🔮'.repeat(100))}`);
    await assertContractResponse('catalog', 'listItems', 200, unicodeSearch);
    expect((await unicodeSearch.json() as { items: unknown[] }).items).toEqual([]);
    const spec = await service.get('/internal/openapi.json');
    expect(spec.status()).toBe(200);
    const expected = readFileSync('/work/contracts/bundled/catalog.json');
    assertExpectedSpec(expected, await spec.body());
  } finally { await customer.dispose(); await service.dispose(); }
});

test('catalog item lifecycle and authoritative private quote match OpenAPI', async () => {
  const admin = await publicContext(adminCert);
  const service = await privateContext();
  try {
    const detail = await admin.get('/api/catalog/items/wand-embers');
    await assertContractResponse('catalog', 'getItem', 200, detail);
    expect((await detail.json() as { priceCopper: number }).priceCopper).toBe(12000);
    const newItem = { name: 'Contract Test Wand', description: 'Created by the catalog contract suite', rarity: 'Rare', image: '/images/wand-embers.png', priceCopper: 1234 };
    validateJsonRequest('catalog', 'createItem', newItem);
    const create = await admin.post('/api/catalog/items', { data: newItem });
    await assertContractResponse('catalog', 'createItem', 201, create);
    const created = await create.json() as { id: string; active: boolean };
    expect(created.active).toBe(true);
    expect(create.headers().location).toBe(`/api/catalog/items/${created.id}`);
    const patch = { priceCopper: 1500, displayStock: 3 };
    validateJsonRequest('catalog', 'updateItem', patch);
    const update = await admin.patch(`/api/catalog/items/${created.id}`, { data: patch });
    await assertContractResponse('catalog', 'updateItem', 200, update);
    expect((await update.json() as { priceCopper: number }).priceCopper).toBe(1500);
    const quoteBody = { lines: [{ itemId: created.id, quantity: 2 }, { itemId: 'wand-embers', quantity: 1 }] };
    validateJsonRequest('catalog', 'quoteItems', quoteBody);
    const quote = await service.post('/internal/catalog/quotes', { data: quoteBody });
    await assertContractResponse('catalog', 'quoteItems', 200, quote);
    const quoted = await quote.json() as { totalCopper: number; lines: Array<{ lineTotalCopper: number }> };
    expect(quoted.totalCopper).toBe(15000);
    expect(quoted.lines.map(line => line.lineTotalCopper)).toEqual([3000, 12000]);
    const insufficient = await service.post('/internal/catalog/quotes', { data: { lines: [{ itemId: created.id, quantity: 4 }] } });
    await assertContractResponse('catalog', 'quoteItems', 422, insufficient);
    const archive = await admin.delete(`/api/catalog/items/${created.id}`);
    await assertContractResponse('catalog', 'archiveItem', 204, archive);
    const gone = await admin.get(`/api/catalog/items/${created.id}`);
    await assertContractResponse('catalog', 'getItem', 404, gone);
    const unavailable = await service.post('/internal/catalog/quotes', { data: { lines: [{ itemId: created.id, quantity: 1 }] } });
    await assertContractResponse('catalog', 'quoteItems', 422, unavailable);
  } finally { await admin.dispose(); await service.dispose(); }
});

test('catalog rejects invalid input, missing token, customer writes and token/certificate mismatch', async () => {
  const customerToken = await userToken(customerCert);
  const adminToken = await userToken(adminCert);
  const customer = await createContractContext({ origin: shop, ...customerCert, accessToken: customerToken });
  const mismatch = await createContractContext({ origin: shop, ...customerCert, accessToken: adminToken });
  const noToken = await request.newContext({ baseURL: shop, clientCertificates: [{ origin: shop, certPath: customerCert.certificatePath, keyPath: customerCert.privateKeyPath }], ignoreHTTPSErrors: false, timeout: 10_000 });
  const service = await privateContext();
  try {
    await assertContractResponse('catalog', 'listItems', 400, await customer.get('/api/catalog/items?limit=101'));
    await assertContractResponse('catalog', 'listItems', 401, await noToken.get('/api/catalog/items'));
    await assertContractResponse('catalog', 'listItems', 403, await mismatch.get('/api/catalog/items'));
    await assertContractResponse('catalog', 'createItem', 403, await customer.post('/api/catalog/items', { data: { name: 'Forbidden', description: '', rarity: 'Rare', image: '/images/wand-embers.png', priceCopper: 1 } }));
    await assertContractResponse('catalog', 'quoteItems', 400, await service.post('/internal/catalog/quotes', { data: { lines: [{ itemId: 'wand-embers', quantity: 0 }] } }));
    await assertContractResponse('catalog', 'getItem', 400, await customer.get('/api/catalog/items/INVALID'));
    await assertContractResponse('catalog', 'updateItem', 403, await customer.patch('/api/catalog/items/wand-embers', { data: { priceCopper: 1 } }));
    await assertContractResponse('catalog', 'archiveItem', 403, await customer.delete('/api/catalog/items/wand-embers'));
  } finally { await customer.dispose(); await mismatch.dispose(); await noToken.dispose(); await service.dispose(); }
});

test('catalog rejects tampered signatures and private caller/token substitution', async () => {
  const user = await userToken(customerCert);
  const pieces = user.split('.');
  pieces[2] = (pieces[2][0] === 'A' ? 'B' : 'A') + pieces[2].slice(1);
  const tampered = await createContractContext({ origin: shop, ...customerCert, accessToken: pieces.join('.') });
  const userAsService = await createContractContext({ origin: 'https://catalog-api:8443', certificatePath: '/service-identity/cert.pem', privateKeyPath: '/service-identity/key.pem', accessToken: user });
  const wrongCaller = await createContractContext({ origin: 'https://catalog-api:8443', certificatePath: '/reporting-identity/cert.pem', privateKeyPath: '/reporting-identity/key.pem', accessToken: await serviceToken() });
  const reportingToken = await new ServiceTokenClient({ target: { issuer, origins: [auth] }, clientId: 'insights-reporting', secretFile: '/reporting-secret/client-secret', audience: 'customer-api', scopes: ['reporting.read'] }).getToken();
  const wrongServiceToken = await createContractContext({ origin: 'https://catalog-api:8443', certificatePath: '/service-identity/cert.pem', privateKeyPath: '/service-identity/key.pem', accessToken: reportingToken });
  const noCert = await request.newContext({ baseURL: 'https://catalog-api:8443', ignoreHTTPSErrors: false, timeout: 5_000 });
  try {
    await assertContractResponse('catalog', 'listItems', 401, await tampered.get('/api/catalog/items'));
    await assertContractResponse('catalog', 'quoteItems', 403, await userAsService.post('/internal/catalog/quotes', { data: { lines: [{ itemId: 'wand-embers', quantity: 1 }] } }));
    await assertContractResponse('catalog', 'quoteItems', 403, await wrongCaller.post('/internal/catalog/quotes', { data: { lines: [{ itemId: 'wand-embers', quantity: 1 }] } }));
    await assertContractResponse('catalog', 'quoteItems', 401, await wrongServiceToken.post('/internal/catalog/quotes', { data: { lines: [{ itemId: 'wand-embers', quantity: 1 }] } }));
    await expect(noCert.post('/internal/catalog/quotes', { data: { lines: [{ itemId: 'wand-embers', quantity: 1 }] } })).rejects.toThrow();
    const publicRoute = await createContractContext({ origin: shop, ...customerCert, accessToken: user });
    try { expect((await publicRoute.get('/internal/catalog/quotes')).status()).toBe(404); }
    finally { await publicRoute.dispose(); }
  } finally { await tampered.dispose(); await userAsService.dispose(); await wrongCaller.dispose(); await wrongServiceToken.dispose(); await noCert.dispose(); }
});

test('catalog documents every operation’s common input and authorization failures', async () => {
  const customerToken = await userToken(customerCert);
  const adminToken = await userToken(adminCert);
  const customer = await createContractContext({ origin: shop, ...customerCert, accessToken: customerToken });
  const mismatch = await createContractContext({ origin: shop, ...customerCert, accessToken: adminToken });
  const admin = await createContractContext({ origin: shop, ...adminCert, accessToken: adminToken });
  const noUserToken = await request.newContext({ baseURL: shop, clientCertificates: [{ origin: shop, certPath: customerCert.certificatePath, keyPath: customerCert.privateKeyPath }], ignoreHTTPSErrors: false, timeout: 10_000 });
  const noServiceToken = await request.newContext({ baseURL: 'https://catalog-api:8443', clientCertificates: [{ origin: 'https://catalog-api:8443', certPath: '/service-identity/cert.pem', keyPath: '/service-identity/key.pem' }], ignoreHTTPSErrors: false, timeout: 10_000 });
  const userAsService = await createContractContext({ origin: 'https://catalog-api:8443', certificatePath: '/service-identity/cert.pem', privateKeyPath: '/service-identity/key.pem', accessToken: customerToken });
  const service = await privateContext();
  const item = { name: 'Validation Wand', description: '', rarity: 'Rare', image: '/images/wand-embers.png', priceCopper: 1 };
  try {
    await assertContractResponse('catalog', 'listItems', 400, await customer.get('/api/catalog/items?limit=0'));
    await assertContractResponse('catalog', 'createItem', 400, await admin.post('/api/catalog/items', { data: { ...item, unexpected: true } }));
    await assertContractResponse('catalog', 'getItem', 400, await customer.get('/api/catalog/items/INVALID'));
    await assertContractResponse('catalog', 'updateItem', 400, await admin.patch('/api/catalog/items/INVALID', { data: { priceCopper: 2 } }));
    await assertContractResponse('catalog', 'archiveItem', 400, await admin.delete('/api/catalog/items/INVALID'));
    await assertContractResponse('catalog', 'quoteItems', 400, await service.post('/internal/catalog/quotes', { data: { lines: [{ itemId: 'wand-embers', quantity: 1, unexpected: true }] } }));

    await assertContractResponse('catalog', 'listItems', 401, await noUserToken.get('/api/catalog/items'));
    await assertContractResponse('catalog', 'createItem', 401, await noUserToken.post('/api/catalog/items', { data: item }));
    await assertContractResponse('catalog', 'getItem', 401, await noUserToken.get('/api/catalog/items/wand-embers'));
    await assertContractResponse('catalog', 'updateItem', 401, await noUserToken.patch('/api/catalog/items/wand-embers', { data: { priceCopper: 2 } }));
    await assertContractResponse('catalog', 'archiveItem', 401, await noUserToken.delete('/api/catalog/items/wand-embers'));
    await assertContractResponse('catalog', 'quoteItems', 401, await noServiceToken.post('/internal/catalog/quotes', { data: { lines: [{ itemId: 'wand-embers', quantity: 1 }] } }));

    await assertContractResponse('catalog', 'listItems', 403, await mismatch.get('/api/catalog/items'));
    await assertContractResponse('catalog', 'createItem', 403, await customer.post('/api/catalog/items', { data: item }));
    await assertContractResponse('catalog', 'getItem', 403, await mismatch.get('/api/catalog/items/wand-embers'));
    await assertContractResponse('catalog', 'updateItem', 403, await customer.patch('/api/catalog/items/wand-embers', { data: { priceCopper: 2 } }));
    await assertContractResponse('catalog', 'archiveItem', 403, await customer.delete('/api/catalog/items/wand-embers'));
    await assertContractResponse('catalog', 'quoteItems', 403, await userAsService.post('/internal/catalog/quotes', { data: { lines: [{ itemId: 'wand-embers', quantity: 1 }] } }));
  } finally { await Promise.all([customer, mismatch, admin, noUserToken, noServiceToken, userAsService, service].map(context => context.dispose())); }
});
