import assert from 'node:assert/strict';
import { request, test } from '@playwright/test';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { request as httpsRequest } from 'node:https';
import { lookup } from 'node:dns';
import { userToken } from '../../api/contracts/user-token.ts';
import { validateJsonRequest, validatePlaywrightResponse, validateHttpResponse } from '../../api/contracts/validator.ts';
import { pool, snapshot, savedOrder } from '../checkout/database.mjs';
import { observer, pendingInserts, race } from './barrier.mjs';
const shop = 'https://shop.magic.test:8443';
const cert = { certificatePath: '/identity-customer/cert.pem', privateKeyPath: '/identity-customer/key.pem' };
const owner = JSON.parse(readFileSync('/work/seed/identities.json')).find(item => item.username === 'customer-waterdeep').sub;
const body = quantity => ({ regionId: 'waterdeep', lines: [{ itemId: 'wand-embers', quantity }] });
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const databaseEvidence = (before, after) => ({ beforeTotal: before.total, afterTotal: after.total, beforeMatching: before.matching, afterMatching: after.matching, revisionBefore: before.revision, revisionAfter: after.revision });
const annotate = value => test.info().annotations.push({ type: 'checkout-idempotency', description: JSON.stringify(value) });
async function customer() {
  return request.newContext({ baseURL: shop, clientCertificates: [{ origin: shop, certPath: cert.certificatePath, keyPath: cert.privateKeyPath }],
    extraHTTPHeaders: { Authorization: `Bearer ${await userToken(cert)}` }, ignoreHTTPSErrors: false, timeout: 10000 });
}
const post = (context, key, value) => context.post('/api/customer/orders', { data: value, headers: { 'Idempotency-Key': key } });
async function persisted(key, value, order, before) {
  const after = await snapshot(owner, key);
  assert.equal(after.tls, true); assert.equal(after.matching, 1); assert.equal(after.total, before.total + 1);
  assert.equal(BigInt(after.revision), BigInt(before.revision) + 1n);
  const rows = await savedOrder(owner, key); assert.equal(rows.length, 1);
  assert.equal(rows[0].order_id, order.orderId); assert.equal(rows[0].request_hash, hash(value));
  assert.equal(rows[0].status, 'completed'); assert.equal(rows[0].total_copper, value.lines[0].quantity * 12000);
  assert.equal(order.ownerSub, owner); assert.equal(order.regionId, value.regionId);
  assert.equal(order.totalCopper, value.lines[0].quantity * 12000);
  assert.deepEqual(order.lines, [{ itemId: 'wand-embers', name: 'Wand of Embers', unitPriceCopper: 12000, quantity: value.lines[0].quantity, lineTotalCopper: value.lines[0].quantity * 12000 }]);
  assert.deepEqual(rows[0].lines, order.lines);
  return after;
}
async function replay(context, key, value, order, after) {
  const response = await post(context, key, value); await validatePlaywrightResponse('customer', 'createOrder', 201, response);
  assert.deepEqual(await response.json(), order); assert.equal(response.headers().location, `/api/customer/orders/${order.orderId}`);
  assert.deepEqual(await snapshot(owner, key), after);
}
async function conflict(context, key, value, after) {
  const response = await post(context, key, value); await validatePlaywrightResponse('customer', 'createOrder', 409, response);
  assert.deepEqual(await response.json(), { code: 'conflict', message: 'conflict' });
  assert.equal(response.headers().location, undefined); assert.deepEqual(await snapshot(owner, key), after);
}
test.afterAll(async () => { await pool.end(); await observer.end(); });
// TEST-08: database-observed concurrency, never inferred from elapsed time.
test('TEST-08 four identical blocked inserts produce one order and stable replay', async () => {
  const contexts = await Promise.all(Array.from({ length: 4 }, customer)); const key = `race-${randomUUID()}`; const value = body(2);
  try {
    validateJsonRequest('customer', 'createOrder', value); const before = await snapshot(owner, key); assert.equal(before.matching, 0);
    const responses = await race(contexts.map(context => () => post(context, key, value)));
    for (const response of responses) await validatePlaywrightResponse('customer', 'createOrder', 201, response);
    const order = await responses[0].json();
    for (const response of responses) { assert.deepEqual(await response.json(), order); assert.equal(response.headers().location, `/api/customer/orders/${order.orderId}`); }
    const after = await persisted(key, value, order, before); await replay(contexts[0], key, value, order, after);
    assert.equal(await pendingInserts(), 0);
    annotate({ scenario: 'identical-race', database: databaseEvidence(before, after), observedBlockedInserts: 4, statuses: [201, 201, 201, 201], oneOrder: true, revisionDelta: 1, requestHashMatched: true, stableReplay: true, databaseTls: true });
  } finally { await Promise.all(contexts.map(context => context.dispose())); }
});
test('TEST-08 conflicting blocked inserts select one winner and documented 409', async () => {
  const contexts = await Promise.all([customer(), customer()]); const values = [body(1), body(2)]; const key = `conflict-${randomUUID()}`;
  try {
    values.forEach(value => validateJsonRequest('customer', 'createOrder', value)); const before = await snapshot(owner, key); assert.equal(before.matching, 0);
    const responses = await race(contexts.map((context, index) => () => post(context, key, values[index])));
    assert.deepEqual(responses.map(response => response.status()).sort(), [201, 409]);
    const winner = responses.findIndex(response => response.status() === 201); const loser = 1 - winner;
    await validatePlaywrightResponse('customer', 'createOrder', 201, responses[winner]); await validatePlaywrightResponse('customer', 'createOrder', 409, responses[loser]);
    assert.deepEqual(await responses[loser].json(), { code: 'conflict', message: 'conflict' });
    assert.equal(responses[loser].headers().location, undefined);
    const order = await responses[winner].json(); assert.equal(responses[winner].headers().location, `/api/customer/orders/${order.orderId}`);
    const after = await persisted(key, values[winner], order, before); await replay(contexts[winner], key, values[winner], order, after);
    await conflict(contexts[loser], key, values[loser], after); assert.equal(await pendingInserts(), 0);
    annotate({ scenario: 'conflicting-race', database: databaseEvidence(before, after), observedBlockedInserts: 2, statuses: [201, 409], oneOrder: true, revisionDelta: 1, requestHashMatched: true, stableReplay: true, conflictingReplay: 409, databaseTls: true });
  } finally { await Promise.all(contexts.map(context => context.dispose())); }
});
function lostResponse(token, value, key, options = {}) {
  return new Promise((resolve, reject) => {
    let responseStarted = false;
    const req = httpsRequest(`${shop}/api/customer/orders`, {
      lookup: (_hostname, dnsOptions, callback) => lookup(process.env.CHECKOUT_LOSS_HOST, dnsOptions, callback),
      ca: readFileSync('/public/server-ca.pem'), cert: readFileSync(cert.certificatePath), key: readFileSync(cert.privateKeyPath),
      rejectUnauthorized: true, agent: false, method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': key, 'content-type': 'application/json' }, ...options
    }, response => { responseStarted = true; response.resume(); response.on('end', () => resolve({ status: response.statusCode, responseStarted })); });
    req.on('error', error => reject(Object.assign(new Error('Transport failed'), { code: error.code, responseStarted }))); req.end(JSON.stringify(value));
  });
}
test('TEST-08 response discarded after real commit retries without duplicate', async () => {
  const context = await customer(); const key = `lost-${randomUUID()}`; const value = body(2);
  try {
    validateJsonRequest('customer', 'createOrder', value); const before = await snapshot(owner, key); assert.equal(before.matching, 0);
    await assert.rejects(lostResponse(await userToken(cert), value, key), error => error.code === 'ECONNRESET' && error.responseStarted === false);
    const receipt = JSON.parse(readFileSync('/loss-state/receipt.json', 'utf8'));
    validateHttpResponse('customer', 'createOrder', 201, { ...receipt, rawBody: Buffer.from(receipt.rawBody) });
    const order = JSON.parse(receipt.rawBody); const after = await persisted(key, value, order, before);
    await replay(context, key, value, order, after); await conflict(context, key, body(1), after);
    annotate({ scenario: 'lost-response', database: databaseEvidence(before, after), responseStarted: false, transportCode: 'ECONNRESET', committedStatus: 201, retryStatus: 201, oneOrder: true, revisionDelta: 1, requestHashMatched: true, stableReplay: true, conflictingReplay: 409, databaseTls: true });
  } finally { await context.dispose(); }
});
test('TEST-08 response-loss harness keeps TLS and selected certificate boundary', async () => {
  const key = `boundary-${randomUUID()}`; const before = await snapshot(owner, key);
  await assert.rejects(lostResponse('', body(1), key, { ca: readFileSync('/public/user-ca.pem') }));
  await assert.rejects(lostResponse('', body(1), key, { servername: 'wrong.magic.test' }));
  await assert.rejects(lostResponse('', body(1), key, { cert: undefined, key: undefined }));
  await assert.rejects(lostResponse('', body(1), key, { cert: readFileSync('/service-identity/cert.pem'), key: readFileSync('/service-identity/key.pem') }));
  const wrongCustomer = await lostResponse('', body(1), key, { cert: readFileSync('/identity-second-customer/cert.pem'), key: readFileSync('/identity-second-customer/key.pem') });
  assert.equal(wrongCustomer.status, 403);
  const noToken = await lostResponse('', body(1), key); assert.equal(noToken.status, 401);
  const invalidToken = await lostResponse('intentionally-invalid-token', body(1), key); assert.equal(invalidToken.status, 401);
  assert.deepEqual(await snapshot(owner, key), before);
  annotate({ scenario: 'tls-boundary', verifiedTls: true, wrongCaRejected: true, wrongHostnameRejected: true, missingClientRejected: true, wrongClientCaRejected: true, wrongCustomerRejected: true, missingTokenRejected: true, invalidTokenRejected: true, noPersistence: true });
});
