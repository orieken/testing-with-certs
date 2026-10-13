import assert from 'node:assert/strict';
import { request, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { request as httpsRequest } from 'node:https';
import { userToken } from '../../api/contracts/user-token.ts';
import { validateJsonRequest, validatePlaywrightResponse, validateHttpResponse } from '../../api/contracts/validator.ts';
import { pool, snapshot, savedOrder } from './database.mjs';
import { malformedQuoteJson, invalidQuote } from './fault-fixtures.mjs';

const shop = 'https://shop.magic.test:8443';
const cert = { certificatePath: '/identity-customer/cert.pem', privateKeyPath: '/identity-customer/key.pem' };
const owner = JSON.parse(readFileSync('/work/seed/identities.json')).find(item => item.username === 'customer-waterdeep').sub;
const checkout = { regionId: 'waterdeep', lines: [{ itemId: 'wand-embers', quantity: 2 }] };
function select(mode) {
  writeFileSync('/fault-state/control.next', JSON.stringify({ mode }));
  renameSync('/fault-state/control.next', '/fault-state/control.json');
}
function audit() { return JSON.parse(readFileSync('/fault-state/audit.json')); }
async function customer() {
  return request.newContext({ baseURL: shop, clientCertificates: [{ origin: shop, certPath: cert.certificatePath, keyPath: cert.privateKeyPath }], extraHTTPHeaders: { Authorization: `Bearer ${await userToken(cert)}` }, ignoreHTTPSErrors: false, timeout: 10000 });
}
function annotate(value) { test.info().annotations.push({ type: 'checkout-fault', description: JSON.stringify(value) }); }
test.afterAll(async () => { select('healthy'); await pool.end(); });

// TEST-03 / AC: bounded 503, zero persistence, real quote recovery and stable retry.
for (const fault of ['unavailable', 'delay', 'malformed-json', 'invalid-quote']) {
  test(`TEST-03 ${fault}: no order on failure; same-key real recovery`, async () => {
    const context = await customer(); const key = `fault-${randomUUID()}`;
    const before = await snapshot(owner, key); const initial = audit();
    assert.equal(before.tls, true); assert.equal(before.matching, 0);
    validateJsonRequest('customer', 'createOrder', checkout);
    if (fault === 'malformed-json') assert.throws(() => validateHttpResponse('catalog', 'quoteItems', 200, { status: 200, headers: { 'content-type': 'application/json' }, rawBody: Buffer.from(malformedQuoteJson) }), /invalid JSON/);
    if (fault === 'invalid-quote') assert.throws(() => validateHttpResponse('catalog', 'quoteItems', 200, { status: 200, headers: { 'content-type': 'application/json' }, rawBody: Buffer.from(JSON.stringify(invalidQuote)) }), /violates expected OpenAPI/);
    try {
      select(fault);
      const start = performance.now();
      const response = await context.post('/api/customer/orders', { data: checkout, headers: { 'Idempotency-Key': key } });
      const elapsedMs = Math.round(performance.now() - start);
      await validatePlaywrightResponse('customer', 'createOrder', 503, response);
      assert.deepEqual(await response.json(), { code: 'dependency_unavailable', message: 'dependency_unavailable' });
      assert.equal(response.headers().location, undefined);
      assert.ok(elapsedMs < 8000, `Fault exceeded 8000 ms bound: ${elapsedMs}`);
      if (fault === 'delay') assert.ok(elapsedMs >= 4500, `Delay returned before the real 5-second timeout: ${elapsedMs}`);
      assert.deepEqual(await snapshot(owner, key), before);
      assert.deepEqual(await savedOrder(owner, key), []);
      const failedAudit = audit();
      assert.equal(failedAudit.forwarded - initial.forwarded, 1);
      assert.equal(failedAudit.injected - initial.injected, 1);
      select('healthy');
      const restored = await context.post('/api/customer/orders', { data: checkout, headers: { 'Idempotency-Key': key } });
      await validatePlaywrightResponse('customer', 'createOrder', 201, restored);
      const order = await restored.json();
      assert.equal(order.totalCopper, 24000); assert.equal(order.ownerSub, owner);
      assert.deepEqual(order.lines, [{ itemId: 'wand-embers', name: 'Wand of Embers', unitPriceCopper: 12000, quantity: 2, lineTotalCopper: 24000 }]);
      assert.equal(restored.headers().location, `/api/customer/orders/${order.orderId}`);
      const persisted = await snapshot(owner, key);
      assert.equal(persisted.total, before.total + 1); assert.equal(persisted.matching, 1);
      assert.equal(BigInt(persisted.revision), BigInt(before.revision) + 1n);
      const rows = await savedOrder(owner, key);
      assert.equal(rows.length, 1); assert.equal(rows[0].order_id, order.orderId);
      assert.equal(rows[0].status, 'completed'); assert.match(rows[0].request_hash, /^[a-f0-9]{64}$/);
      assert.equal(rows[0].total_copper, 24000); assert.deepEqual(rows[0].lines, order.lines);
      const recoveryAudit = audit();
      const replay = await context.post('/api/customer/orders', { data: checkout, headers: { 'Idempotency-Key': key } });
      await validatePlaywrightResponse('customer', 'createOrder', 201, replay);
      assert.deepEqual(await replay.json(), order);
      assert.deepEqual(await snapshot(owner, key), persisted);
      assert.deepEqual(audit(), recoveryAudit);
      annotate({ fault, operationId: 'createOrder', status: 503, recoveryStatus: 201, elapsedMs, boundMs: 8000, databaseTls: true, noPersistence: true, sameKeyRecovery: true, stableReplay: true, upstreamAuthorizedBeforeFault: true });
    } finally { select('healthy'); await context.dispose(); }
  });
}

function probe({ ca, servername, identity = '/service-identity', token = '', host = process.env.CHECKOUT_FAULT_IP }) {
  return new Promise((resolve, reject) => {
    const req = httpsRequest({ host, port: 8443, servername, ca, rejectUnauthorized: true, agent: false, method: 'POST', path: '/internal/catalog/quotes', signal: AbortSignal.timeout(5000),
      ...(identity ? { cert: readFileSync(`${identity}/cert.pem`), key: readFileSync(`${identity}/key.pem`) } : {}), headers: { 'content-type': 'application/json', authorization: token } }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, rawBody: Buffer.concat(chunks) })); res.on('error', reject);
    });
    req.on('error', reject); req.end(JSON.stringify({ lines: checkout.lines }));
  });
}
test('TEST-03 verified TLS and live Go authorization remain mandatory', async () => {
  const ca = readFileSync('/public/server-ca.pem'); const initial = audit();
  const missing = await probe({ ca, servername: 'catalog-api' });
  validateHttpResponse('catalog', 'quoteItems', 401, missing);
  const invalid = await probe({ ca, servername: 'catalog-api', token: 'Bearer intentionally-invalid-token' });
  validateHttpResponse('catalog', 'quoteItems', 401, invalid);
  assert.equal(audit().injected, initial.injected);
  await assert.rejects(probe({ ca: readFileSync('/public/user-ca.pem'), servername: 'catalog-api' }));
  await assert.rejects(probe({ ca, servername: 'wrong.magic.test' }));
  await assert.rejects(probe({ ca, servername: 'catalog-api', identity: null }));
  await assert.rejects(probe({ ca, servername: 'catalog-api', identity: '/identity-customer' }));
  const wrongCaller = await probe({ ca, servername: 'catalog-api', identity: '/reporting-identity' });
  assert.equal(wrongCaller.status, 403);
  // Negative controls for the upstream verifier itself, using the same real origin.
  await assert.rejects(probe({ ca: readFileSync('/public/user-ca.pem'), servername: 'catalog-api', host: 'catalog-api' }));
  await assert.rejects(probe({ ca, servername: 'wrong.magic.test', host: 'catalog-api' }));
  annotate({ fault: 'tls-boundary', verifiedDownstream: true, verifiedUpstream: true, missingTokenRejected: true, alteredTokenRejected: true, missingClientRejected: true, wrongClientCaRejected: true, wrongCallerRejected: true });
});
