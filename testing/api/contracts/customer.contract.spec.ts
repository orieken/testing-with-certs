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
const secondCert = { certificatePath: '/identity-second-customer/cert.pem', privateKeyPath: '/identity-second-customer/key.pem' };
const adminCert = { certificatePath: '/identity-admin/cert.pem', privateKeyPath: '/identity-admin/key.pem' };
async function userToken(cert: typeof customerCert): Promise<string> {
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
async function reportingToken(): Promise<string> {
  return new ServiceTokenClient({ target: { issuer, origins: [auth] }, clientId: 'insights-reporting', secretFile: '/reporting-secret/client-secret', audience: 'customer-api', scopes: ['reporting.read'] }).getToken();
}
async function publicContext(cert: typeof customerCert): Promise<APIRequestContext> { return createContractContext({ origin: shop, ...cert, accessToken: await userToken(cert) }); }
async function privateContext(): Promise<APIRequestContext> { return createContractContext({ origin: 'https://customer-api:8443', certificatePath: '/reporting-identity/cert.pem', privateKeyPath: '/reporting-identity/key.pem', accessToken: await reportingToken() }); }

test('customer profile, owned orders, widgets and admin lists match OpenAPI', async () => {
  const customer = await publicContext(customerCert); const second = await publicContext(secondCert); const admin = await publicContext(adminCert);
  try {
    const me = await customer.get('/api/customer/me'); await assertContractResponse('customer', 'getMyProfile', 200, me);
    expect((await me.json() as { displayName: string }).displayName).toBe('Arin of Waterdeep');
    const patch = { displayName: 'Arin Contract Test' }; validateJsonRequest('customer', 'updateMyProfile', patch);
    const changed = await customer.patch('/api/customer/me', { data: patch }); await assertContractResponse('customer', 'updateMyProfile', 200, changed);
    expect((await changed.json() as { displayName: string }).displayName).toBe(patch.displayName);
    const restored = await customer.patch('/api/customer/me', { data: { displayName: 'Arin of Waterdeep' } }); await assertContractResponse('customer', 'updateMyProfile', 200, restored);
    const orders = await customer.get('/api/customer/orders?limit=1'); await assertContractResponse('customer', 'listMyOrders', 200, orders);
    const page = await orders.json() as { items: Array<{ orderId: string; ownerSub: string }>; nextCursor: string | null };
    expect(page.items).toHaveLength(1); expect(page.nextCursor).toBeTruthy();
    const detail = await customer.get(`/api/customer/orders/${page.items[0]!.orderId}`); await assertContractResponse('customer', 'getMyOrder', 200, detail);
    const hidden = await second.get(`/api/customer/orders/${page.items[0]!.orderId}`); await assertContractResponse('customer', 'getMyOrder', 404, hidden);
    const widgets = await customer.get('/api/customer/me/widgets'); await assertContractResponse('customer', 'getMyWidgets', 200, widgets);
    const layout = { widgetIds: ['recent-orders'] }; validateJsonRequest('customer', 'putMyWidgets', layout);
    const saved = await customer.put('/api/customer/me/widgets', { data: layout }); await assertContractResponse('customer', 'putMyWidgets', 200, saved);
    const forbiddenLayout = await customer.put('/api/customer/me/widgets', { data: { widgetIds: ['total-sales'] } }); await assertContractResponse('customer', 'putMyWidgets', 422, forbiddenLayout);
    const adminLayout = await admin.put('/api/customer/me/widgets', { data: { widgetIds: ['total-sales', 'customer-list'] } }); await assertContractResponse('customer', 'putMyWidgets', 200, adminLayout);
    const users = await admin.get('/api/customer/admin/users?limit=2&regionId=waterdeep'); await assertContractResponse('customer', 'listAdminUsers', 200, users);
    const userPage = await users.json() as { items: Array<{ sub: string }>; nextCursor: string | null }; expect(userPage.items.length).toBe(2); expect(userPage.nextCursor).toBeNull();
    const allUsers = await admin.get('/api/customer/admin/users?limit=2'); await assertContractResponse('customer', 'listAdminUsers', 200, allUsers);
    expect((await allUsers.json() as { nextCursor: string | null }).nextCursor).toBeTruthy();
    const adminOrders = await admin.get('/api/customer/admin/orders?regionId=waterdeep&status=completed&limit=2'); await assertContractResponse('customer', 'listAdminOrders', 200, adminOrders);
    expect((await adminOrders.json() as { items: Array<{ regionId: string; status: string }> }).items.every(item => item.regionId === 'waterdeep' && item.status === 'completed')).toBe(true);
    await assertContractResponse('customer', 'listAdminUsers', 403, await customer.get('/api/customer/admin/users'));
    await assertContractResponse('customer', 'listAdminOrders', 403, await customer.get('/api/customer/admin/orders'));
  } finally { await customer.dispose(); await second.dispose(); await admin.dispose(); }
});

test('checkout prices come from Go and replay is idempotent', async () => {
  const customer = await publicContext(customerCert); const second = await publicContext(secondCert);
  try {
    const key = `contract-${randomBytes(12).toString('hex')}`;
    const checkout = { regionId: 'waterdeep', lines: [{ itemId: 'wand-embers', quantity: 2 }] };
    validateJsonRequest('customer', 'createOrder', checkout);
    const created = await customer.post('/api/customer/orders', { headers: { 'Idempotency-Key': key }, data: checkout });
    await assertContractResponse('customer', 'createOrder', 201, created);
    const order = await created.json() as { orderId: string; totalCopper: number; ownerSub: string; lines: Array<{ unitPriceCopper: number }> };
    expect(order.totalCopper).toBe(24000); expect(order.lines[0]?.unitPriceCopper).toBe(12000);
    expect(created.headers().location).toBe(`/api/customer/orders/${order.orderId}`);
    const replay = await customer.post('/api/customer/orders', { headers: { 'Idempotency-Key': key }, data: checkout }); await assertContractResponse('customer', 'createOrder', 201, replay);
    expect((await replay.json() as { orderId: string }).orderId).toBe(order.orderId);
    await assertContractResponse('customer', 'createOrder', 409, await customer.post('/api/customer/orders', { headers: { 'Idempotency-Key': key }, data: { ...checkout, lines: [{ itemId: 'wand-embers', quantity: 1 }] } }));
    await assertContractResponse('customer', 'createOrder', 400, await customer.post('/api/customer/orders', { headers: { 'Idempotency-Key': `tamper-${randomBytes(12).toString('hex')}` }, data: { ...checkout, totalCopper: 1 } }));
    await assertContractResponse('customer', 'createOrder', 422, await customer.post('/api/customer/orders', { headers: { 'Idempotency-Key': `missing-${randomBytes(12).toString('hex')}` }, data: { regionId: 'waterdeep', lines: [{ itemId: 'unknown-item', quantity: 1 }] } }));
    await assertContractResponse('customer', 'getMyOrder', 404, await second.get(`/api/customer/orders/${order.orderId}`));
  } finally { await customer.dispose(); await second.dispose(); }
});

test('private reporting is revision-pinned and spec is authenticated', async () => {
  const service = await privateContext(); const customer = await publicContext(customerCert);
  try {
    const first = await service.get('/internal/reporting/orders?limit=1'); await assertContractResponse('customer', 'listReportingOrders', 200, first);
    const page = await first.json() as { revision: string; items: Array<{ order: { orderId: string }; customer: { sub: string } }>; nextCursor: string | null };
    expect(page.items).toHaveLength(1); expect(page.nextCursor).toBeTruthy();
    const next = await service.get(`/internal/reporting/orders?limit=1&cursor=${encodeURIComponent(page.nextCursor!)}&revision=${page.revision}`); await assertContractResponse('customer', 'listReportingOrders', 200, next);
    expect((await next.json() as { revision: string }).revision).toBe(page.revision);
    const deployed = await service.get('/internal/openapi.json'); expect(deployed.status()).toBe(200);
    assertExpectedSpec(readFileSync('/work/contracts/bundled/customer.json'), await deployed.body());
    await customer.patch('/api/customer/me', { data: { displayName: 'Arin Contract Revision' } });
    await assertContractResponse('customer', 'listReportingOrders', 409, await service.get(`/internal/reporting/orders?limit=1&cursor=${encodeURIComponent(page.nextCursor!)}&revision=${page.revision}`));
    await customer.patch('/api/customer/me', { data: { displayName: 'Arin of Waterdeep' } });
    const gateway = await customer.get('/internal/reporting/orders'); expect(gateway.status()).toBe(404);
  } finally { await service.dispose(); await customer.dispose(); }
});

test('each customer operation rejects malformed input and missing or mismatched credentials', async () => {
  const customerToken = await userToken(customerCert); const adminToken = await userToken(adminCert); const serviceToken = await reportingToken();
  const customer = await createContractContext({ origin: shop, ...customerCert, accessToken: customerToken });
  const admin = await createContractContext({ origin: shop, ...adminCert, accessToken: adminToken });
  const mismatch = await createContractContext({ origin: shop, ...customerCert, accessToken: adminToken });
  const noToken = await request.newContext({ baseURL: shop, clientCertificates: [{ origin: shop, certPath: customerCert.certificatePath, keyPath: customerCert.privateKeyPath }], ignoreHTTPSErrors: false, timeout: 10_000 });
  const service = await createContractContext({ origin: 'https://customer-api:8443', certificatePath: '/reporting-identity/cert.pem', privateKeyPath: '/reporting-identity/key.pem', accessToken: serviceToken });
  const noServiceToken = await request.newContext({ baseURL: 'https://customer-api:8443', clientCertificates: [{ origin: 'https://customer-api:8443', certPath: '/reporting-identity/cert.pem', keyPath: '/reporting-identity/key.pem' }], ignoreHTTPSErrors: false, timeout: 10_000 });
  const wrongCaller = await createContractContext({ origin: 'https://customer-api:8443', certificatePath: '/service-identity/cert.pem', privateKeyPath: '/service-identity/key.pem', accessToken: serviceToken });
  try {
    const cases: Array<{ id: string; good: APIRequestContext; bad: () => Promise<import('@playwright/test').APIResponse>; path: string; method: 'get' | 'patch' | 'post' | 'put' }> = [
      { id: 'getMyProfile', good: customer, path: '/api/customer/me', method: 'get', bad: () => customer.get('/api/customer/me?bad=1') },
      { id: 'updateMyProfile', good: customer, path: '/api/customer/me', method: 'patch', bad: () => customer.patch('/api/customer/me', { data: { sub: 'forged' } }) },
      { id: 'listMyOrders', good: customer, path: '/api/customer/orders', method: 'get', bad: () => customer.get('/api/customer/orders?limit=101') },
      { id: 'createOrder', good: customer, path: '/api/customer/orders', method: 'post', bad: () => customer.post('/api/customer/orders', { headers: { 'Idempotency-Key': '0123456789abcdef' }, data: { regionId: 'waterdeep', lines: [] } }) },
      { id: 'getMyOrder', good: customer, path: '/api/customer/orders/INVALID', method: 'get', bad: () => customer.get('/api/customer/orders/INVALID') },
      { id: 'getMyWidgets', good: customer, path: '/api/customer/me/widgets', method: 'get', bad: () => customer.get('/api/customer/me/widgets?bad=1') },
      { id: 'putMyWidgets', good: customer, path: '/api/customer/me/widgets', method: 'put', bad: () => customer.put('/api/customer/me/widgets', { data: { widgetIds: ['recent-orders', 'recent-orders'] } }) },
      { id: 'listAdminUsers', good: customer, path: '/api/customer/admin/users', method: 'get', bad: () => admin.get('/api/customer/admin/users?limit=0') },
      { id: 'listAdminOrders', good: customer, path: '/api/customer/admin/orders', method: 'get', bad: () => admin.get('/api/customer/admin/orders?status=wrong') },
      { id: 'listReportingOrders', good: service, path: '/internal/reporting/orders', method: 'get', bad: () => service.get('/internal/reporting/orders?limit=0') }
    ];
    for (const entry of cases) {
      await assertContractResponse('customer', entry.id, 400, await entry.bad());
      const missing = entry.id === 'listReportingOrders' ? noServiceToken : noToken;
      await assertContractResponse('customer', entry.id, 401, await missing[entry.method](entry.path));
      const forbidden = entry.id === 'listReportingOrders' ? wrongCaller : mismatch;
      await assertContractResponse('customer', entry.id, 403, await forbidden[entry.method](entry.path));
    }
    const parts = customerToken.split('.');
    if (parts.length !== 3 || !parts[2]) throw new Error('Unexpected access-token form');
    parts[2] = `${parts[2][0] === 'A' ? 'B' : 'A'}${parts[2].slice(1)}`;
    const tampered = await createContractContext({ origin: shop, ...customerCert, accessToken: parts.join('.') });
    try { await assertContractResponse('customer', 'getMyProfile', 401, await tampered.get('/api/customer/me')); } finally { await tampered.dispose(); }
    const userAsService = await createContractContext({ origin: 'https://customer-api:8443', certificatePath: '/reporting-identity/cert.pem', privateKeyPath: '/reporting-identity/key.pem', accessToken: customerToken });
    try { await assertContractResponse('customer', 'listReportingOrders', 403, await userAsService.get('/internal/reporting/orders')); } finally { await userAsService.dispose(); }
    const catalogToken = await new ServiceTokenClient({ target: { issuer, origins: [auth] }, clientId: 'customer-catalog', secretFile: '/service-secret/client-secret', audience: 'catalog-api', scopes: ['catalog.quote'] }).getToken();
    const wrongAudience = await createContractContext({ origin: 'https://customer-api:8443', certificatePath: '/reporting-identity/cert.pem', privateKeyPath: '/reporting-identity/key.pem', accessToken: catalogToken });
    try { await assertContractResponse('customer', 'listReportingOrders', 401, await wrongAudience.get('/internal/reporting/orders')); } finally { await wrongAudience.dispose(); }
    const noCert = await request.newContext({ baseURL: 'https://customer-api:8443', ignoreHTTPSErrors: false, timeout: 5000 });
    try { await expect(noCert.get('/internal/reporting/orders')).rejects.toThrow(); } finally { await noCert.dispose(); }
  } finally { await customer.dispose(); await admin.dispose(); await mismatch.dispose(); await noToken.dispose(); await service.dispose(); await noServiceToken.dispose(); await wrongCaller.dispose(); }
});
