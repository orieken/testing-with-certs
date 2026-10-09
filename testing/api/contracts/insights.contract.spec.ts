import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { request, test, expect, type APIRequestContext } from '@playwright/test';
import { ServiceTokenClient } from 'saturday-keycloak-prototype';
import { assertContractResponse, assertExpectedSpec, createContractContext } from './fixtures.js';
import { validateJsonRequest } from './validator.js';

const shop = 'https://shop.magic.test:8443';
const auth = 'https://auth.magic.test:9443';
const issuer = `${auth}/realms/magic-shop`;
const adminCert = { certificatePath: '/identity-admin/cert.pem', privateKeyPath: '/identity-admin/key.pem' };
const customerCert = { certificatePath: '/identity-customer/cert.pem', privateKeyPath: '/identity-customer/key.pem' };
const period = 'from=2026-09-01T00%3A00%3A00Z&to=2026-10-01T00%3A00%3A00Z';
async function userToken(cert: typeof adminCert): Promise<string> {
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
    if (callback.origin !== shop || callback.pathname !== '/callback' || callback.searchParams.get('state') !== state || !code) throw new Error('Unexpected authorization callback');
    const token = await context.post(`${issuer}/protocol/openid-connect/token`, { form: { grant_type: 'authorization_code', client_id: 'shop-spa', code, redirect_uri: `${shop}/callback`, code_verifier: verifier } });
    if (token.status() !== 200) throw new Error(`Code exchange returned ${token.status()}`);
    const value = await token.json() as { access_token?: string }; if (!value.access_token) throw new Error('Access token missing');
    return value.access_token;
  } finally { await context.dispose(); }
}
async function adminContext(): Promise<APIRequestContext> { return createContractContext({ origin: shop, ...adminCert, accessToken: await userToken(adminCert) }); }

test('regional sales, map, customers and orders match the seeded oracle', async () => {
  const admin = await adminContext();
  try {
    const regionResponse = await admin.get('/api/insights/regions?limit=2'); await assertContractResponse('insights', 'listRegions', 200, regionResponse);
    const collection = await regionResponse.json() as { type: string; features: Array<{ properties: { regionId: string }; geometry: { coordinates: number[][][] } }> };
    expect(collection.type).toBe('FeatureCollection'); expect(collection.features).toHaveLength(2);
    expect(collection.features[0]?.geometry.coordinates[0]?.[0]).toEqual([-120.5, 44.5]);
    const cursor = regionResponse.headers()['x-next-cursor']; expect(cursor).toBeTruthy();
    await assertContractResponse('insights', 'listRegions', 200, await admin.get(`/api/insights/regions?limit=2&cursor=${encodeURIComponent(cursor!)}`));
    const salesResponse = await admin.get(`/api/insights/sales?${period}`); await assertContractResponse('insights', 'getSalesSummary', 200, salesResponse);
    const summary = await salesResponse.json() as { orderCount: number; customerCount: number; salesCopper: number; regions: Array<{ regionId: string; salesCopper: number }> };
    const oracle = JSON.parse(readFileSync('/work/seed/reporting-oracle.json', 'utf8')) as { overall: { orderCount: number; customerCount: number; salesCopper: number }; regions: Array<{ regionId: string; salesCopper: number }> };
    // Live contract/browser checkout may add October orders, outside this fixed September window.
    expect([summary.orderCount, summary.customerCount, summary.salesCopper]).toEqual([oracle.overall.orderCount, oracle.overall.customerCount, oracle.overall.salesCopper]);
    expect(summary.regions.map(item => [item.regionId, item.salesCopper])).toEqual(oracle.regions.map(item => [item.regionId, item.salesCopper]));
    const empty = await admin.get(`/api/insights/sales?${period}&regionId=empty-march`); await assertContractResponse('insights', 'getSalesSummary', 200, empty);
    expect((await empty.json() as { salesCopper: number }).salesCopper).toBe(0);
    const customers = await admin.get(`/api/insights/customers?${period}&regionId=waterdeep&limit=1`); await assertContractResponse('insights', 'listRegionalCustomers', 200, customers);
    const customerPage = await customers.json() as { items: Array<{ sub: string }>; nextCursor: string | null }; expect(customerPage.items).toHaveLength(1); expect(customerPage.nextCursor).toBeTruthy();
    await assertContractResponse('insights', 'listRegionalCustomers', 200, await admin.get(`/api/insights/customers?${period}&regionId=waterdeep&limit=1&cursor=${encodeURIComponent(customerPage.nextCursor!)}`));
    const orders = await admin.get(`/api/insights/orders?${period}&regionId=waterdeep&limit=2`); await assertContractResponse('insights', 'listRegionalOrders', 200, orders);
    const orderPage = await orders.json() as { items: Array<{ orderId: string; regionId: string }>; nextCursor: string | null }; expect(orderPage.items).toHaveLength(2); expect(orderPage.items.every(item => item.regionId === 'waterdeep')).toBe(true);
    expect(orderPage.nextCursor).toBeTruthy();
    await assertContractResponse('insights', 'listRegionalOrders', 200, await admin.get(`/api/insights/orders?${period}&regionId=waterdeep&limit=2&cursor=${encodeURIComponent(orderPage.nextCursor!)}`));
  } finally { await admin.dispose(); }
});

test('follow-up records persist locally and reject unauthorized callers', async () => {
  const adminToken = await userToken(adminCert); const customerToken = await userToken(customerCert);
  const admin = await createContractContext({ origin: shop, ...adminCert, accessToken: adminToken });
  const customer = await createContractContext({ origin: shop, ...customerCert, accessToken: customerToken });
  const mismatch = await createContractContext({ origin: shop, ...customerCert, accessToken: adminToken });
  const noToken = await request.newContext({ baseURL: shop, clientCertificates: [{ origin: shop, certPath: adminCert.certificatePath, keyPath: adminCert.privateKeyPath }], ignoreHTTPSErrors: false, timeout: 10_000 });
  try {
    const initial = await admin.get('/api/insights/follow-ups?limit=1'); await assertContractResponse('insights', 'listFollowUps', 200, initial);
    const form = { customerSub: '10101010-1010-4010-8010-101010101010', regionId: 'waterdeep', note: 'Local contract follow-up' };
    validateJsonRequest('insights', 'createFollowUp', form);
    const created = await admin.post('/api/insights/follow-ups', { data: form }); await assertContractResponse('insights', 'createFollowUp', 201, created);
    const record = await created.json() as { followUpId: string; status: string; authorSub: string }; expect(record.status).toBe('open');
    expect(created.headers().location).toBe(`/api/insights/follow-ups/${record.followUpId}`);
    const patched = await admin.patch(`/api/insights/follow-ups/${record.followUpId}`, { data: { status: 'done' } }); await assertContractResponse('insights', 'updateFollowUp', 200, patched);
    expect((await patched.json() as { status: string }).status).toBe('done');
    const listed = await admin.get('/api/insights/follow-ups?status=done'); await assertContractResponse('insights', 'listFollowUps', 200, listed);
    expect((await listed.json() as { items: Array<{ followUpId: string }> }).items.some(item => item.followUpId === record.followUpId)).toBe(true);
    const reportingToken = await new ServiceTokenClient({ target: { issuer, origins: [auth] }, clientId: 'insights-reporting', secretFile: '/reporting-secret/client-secret', audience: 'customer-api', scopes: ['reporting.read'] }).getToken();
    const specContext = await request.newContext({ baseURL: 'https://insights-api:8443', clientCertificates: [{ origin: 'https://insights-api:8443', certPath: '/reporting-identity/cert.pem', keyPath: '/reporting-identity/key.pem' }], extraHTTPHeaders: { Authorization: `Bearer ${reportingToken}` }, ignoreHTTPSErrors: false, timeout: 10_000 });
    try {
      const deployed = await specContext.get('/internal/openapi.json'); expect(deployed.status()).toBe(200);
      assertExpectedSpec(readFileSync('/work/contracts/bundled/insights.json'), await deployed.body());
    } finally { await specContext.dispose(); }
    await assertContractResponse('insights', 'createFollowUp', 404, await admin.post('/api/insights/follow-ups', { data: { ...form, customerSub: '99999999-9999-4999-8999-999999999999' } }));
    const routes: Array<{ id: string; path: string; method: 'get' | 'post' | 'patch'; bad: () => Promise<import('@playwright/test').APIResponse> }> = [
      { id: 'listRegions', path: '/api/insights/regions', method: 'get', bad: () => admin.get('/api/insights/regions?limit=101') },
      { id: 'getSalesSummary', path: `/api/insights/sales?${period}`, method: 'get', bad: () => admin.get('/api/insights/sales?from=invalid&to=invalid') },
      { id: 'listRegionalCustomers', path: `/api/insights/customers?${period}`, method: 'get', bad: () => admin.get(`/api/insights/customers?${period}&limit=0`) },
      { id: 'listRegionalOrders', path: `/api/insights/orders?${period}`, method: 'get', bad: () => admin.get(`/api/insights/orders?${period}&limit=101`) },
      { id: 'listFollowUps', path: '/api/insights/follow-ups', method: 'get', bad: () => admin.get('/api/insights/follow-ups?status=wrong') },
      { id: 'createFollowUp', path: '/api/insights/follow-ups', method: 'post', bad: () => admin.post('/api/insights/follow-ups', { data: { ...form, extra: true } }) },
      { id: 'updateFollowUp', path: `/api/insights/follow-ups/${record.followUpId}`, method: 'patch', bad: () => admin.patch(`/api/insights/follow-ups/${record.followUpId}`, { data: {} }) }
    ];
    for (const route of routes) {
      await assertContractResponse('insights', route.id, 400, await route.bad());
      await assertContractResponse('insights', route.id, 401, await noToken[route.method](route.path));
      await assertContractResponse('insights', route.id, 403, await customer[route.method](route.path));
      await assertContractResponse('insights', route.id, 403, await mismatch[route.method](route.path));
    }
    const direct = await customer.get('/internal/openapi.json'); expect(direct.status()).toBe(404);
  } finally { await admin.dispose(); await customer.dispose(); await mismatch.dispose(); await noToken.dispose(); }
});
