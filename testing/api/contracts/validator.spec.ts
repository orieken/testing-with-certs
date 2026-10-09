import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { validateHttpResponse, validateJsonRequest } from './validator.js';
import { assertExpectedSpec } from './fixtures.js';

const item = { id: 'potion-healing', name: 'Potion of Healing', description: 'A red liquid that heals wounds.', rarity: 'Common', image: '/images/potion-healing.png', priceCopper: 5000, active: true };
const json = (value: unknown) => Buffer.from(JSON.stringify(value));
const response = (status: number, body: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }) => ({ status, headers, rawBody: json(body) });

test('validates a catalog response and rejects missing, wrong-type and unknown fields', () => {
  const valid = response(200, { items: [item], nextCursor: null });
  expect(() => validateHttpResponse('catalog', 'listItems', 200, valid)).not.toThrow();
  expect(() => validateHttpResponse('catalog', 'listItems', 200, response(200, { items: [{ ...item, name: undefined }], nextCursor: null }))).toThrow(/required property/);
  expect(() => validateHttpResponse('catalog', 'listItems', 200, response(200, { items: [{ ...item, priceCopper: '5000' }], nextCursor: null }))).toThrow(/integer/);
  expect(() => validateHttpResponse('catalog', 'listItems', 200, response(200, { items: [{ ...item, unexpected: true }], nextCursor: null }))).toThrow(/additional properties/);
});

test('rejects unexpected status, media type, missing location and bodyless-content drift', () => {
  expect(() => validateHttpResponse('catalog', 'listItems', 200, response(201, { items: [], nextCursor: null }))).toThrow(/expected HTTP 200/);
  expect(() => validateHttpResponse('catalog', 'listItems', 200, response(200, { items: [], nextCursor: null }, { 'content-type': 'text/plain' }))).toThrow(/application\/json/);
  expect(() => validateHttpResponse('catalog', 'createItem', 201, response(201, item))).toThrow(/Location/);
  expect(() => validateHttpResponse('catalog', 'createItem', 201, response(201, item, { 'Content-Type': 'application/json; charset=utf-8', Location: '/api/catalog/items/potion-healing' }))).not.toThrow();
  expect(() => validateHttpResponse('catalog', 'archiveItem', 204, { status: 204, headers: {}, rawBody: Buffer.from('not empty') })).toThrow(/undocumented response body/);
});

test('validates request shape before sending and rejects client-computed checkout prices', () => {
  const checkout = { regionId: 'waterdeep', lines: [{ itemId: 'potion-healing', quantity: 2 }] };
  expect(() => validateJsonRequest('customer', 'createOrder', checkout)).not.toThrow();
  expect(() => validateJsonRequest('customer', 'createOrder', { ...checkout, totalCopper: 10000 })).toThrow(/additional properties/);
  expect(() => validateJsonRequest('customer', 'createOrder', { ...checkout, lines: [{ itemId: 'potion-healing', quantity: 0 }] })).toThrow(/>= 1/);
});

test('enforces 2020-12 tuple and UTC date-time constraints in a regional response', () => {
  const oracle = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../seed/reporting-oracle.json'), 'utf8')) as { period: { from: string; to: string }; overall: { orderCount: number; customerCount: number; salesCopper: number }; regions: Array<{ regionId: string; orderCount: number; customerCount: number; salesCopper: number }> };
  const body = { from: oracle.period.from, to: oracle.period.to, status: 'completed', ...oracle.overall, regions: oracle.regions.map(({ regionId, orderCount, customerCount, salesCopper }) => ({ regionId, orderCount, customerCount, salesCopper })) };
  expect(() => validateHttpResponse('insights', 'getSalesSummary', 200, response(200, body))).not.toThrow();
  expect(() => validateHttpResponse('insights', 'getSalesSummary', 200, response(200, { ...body, from: '2026-09-01T00:00:00-05:00' }))).toThrow(/pattern/);
  const feature = { type: 'Feature', properties: { regionId: 'waterdeep', name: 'Waterdeep', center: [-120, 45, 7] }, geometry: { type: 'Polygon', coordinates: [[[-120, 45], [-119, 45], [-119, 46], [-120, 45]]] } };
  expect(() => validateHttpResponse('insights', 'listRegions', 200, response(200, { type: 'FeatureCollection', features: [feature] }))).toThrow(/more than 2 items/);
});

test('accepts documented structured errors and rejects malformed error bodies', () => {
  expect(() => validateHttpResponse('customer', 'getMyOrder', 404, response(404, { code: 'not_found', message: 'Order not found' }))).not.toThrow();
  expect(() => validateHttpResponse('customer', 'getMyOrder', 404, response(404, { message: 'Order not found' }))).toThrow(/required property/);
});

test('rejects a deployed OpenAPI artifact changed by one byte', () => {
  const expected = readFileSync(resolve(import.meta.dirname, '../../../contracts/bundled/catalog.json'));
  expect(() => assertExpectedSpec(expected, expected)).not.toThrow();
  const altered = Buffer.from(expected);
  altered[altered.length - 2] ^= 1;
  expect(() => assertExpectedSpec(expected, altered)).toThrow(/differs from repository expectation/);
});
