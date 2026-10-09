import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { canonicalCheckout, validCheckout, validProfilePatch, validQuote, validWidgets } from './domain.js';

test('checkout rejects browser prices and bounds lines before any quote', () => {
  const request = { regionId: 'waterdeep' as const, lines: [{ itemId: 'wand-embers', quantity: 2 }] };
  assert.equal(validCheckout(request), true);
  assert.equal(validCheckout({ ...request, totalCopper: 1 }), false);
  assert.equal(validCheckout({ ...request, lines: [{ ...request.lines[0], quantity: 101 }] }), false);
  assert.equal(canonicalCheckout(request), '{"regionId":"waterdeep","lines":[{"itemId":"wand-embers","quantity":2}]}');
});
test('quote arithmetic and requested line identity must agree', () => {
  const request = { regionId: 'waterdeep' as const, lines: [{ itemId: 'wand-embers', quantity: 2 }] };
  const line = { itemId: 'wand-embers', name: 'Wand', unitPriceCopper: 12000, quantity: 2, lineTotalCopper: 24000 };
  assert.equal(validQuote({ lines: [line], totalCopper: 24000 }, request), true);
  assert.equal(validQuote({ lines: [line], totalCopper: 1 }, request), false);
  assert.equal(validQuote({ lines: [{ ...line, itemId: 'other' }], totalCopper: 24000 }, request), false);
});
test('widget capabilities and profile shapes stay role scoped', () => {
  assert.equal(validWidgets({ widgetIds: ['recent-orders'] }, 'customer'), 'valid');
  assert.equal(validWidgets({ widgetIds: ['total-sales'] }, 'customer'), 'forbidden');
  assert.equal(validWidgets({ widgetIds: ['recent-orders', 'recent-orders'] }, 'shop-admin'), 'invalid');
  assert.equal(validProfilePatch({ regionId: 'waterdeep', location: [-120, 45] }), true);
  assert.equal(validProfilePatch({ sub: 'forged' }), false);
});
