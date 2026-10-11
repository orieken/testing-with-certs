import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { checkCoverage } from './check-contract-coverage.mjs';

const source = resolve(import.meta.dirname, '..');
function fixture(run) {
  const root = mkdtempSync(resolve(tmpdir(), 'coverage-'));
  const write = (path, value) => { mkdirSync(dirname(resolve(root, path)), { recursive: true }); writeFileSync(resolve(root, path), JSON.stringify(value)); };
  const manifest = JSON.parse(readFileSync(resolve(source, 'testing/api/contracts/coverage-manifest.json')));
  const digests = JSON.parse(readFileSync(resolve(source, 'contracts/bundled/digests.json')));
  for (const service of ['catalog', 'customer', 'insights']) write(`contracts/bundled/${service}.json`, JSON.parse(readFileSync(resolve(source, `contracts/bundled/${service}.json`))));
  write('contracts/bundled/digests.json', digests);
  const report = { schemaVersion: 1, source: 'playwright-contracts', specDigests: digests.services, results: manifest.operations.flatMap(entry => entry.requiredStatuses.map(status => ({ service: entry.service, operationId: entry.operationId, status, testId: 'mutation-control-only' }))) };
  try { run({ root, write, manifest, report }); } finally { rmSync(root, { recursive: true, force: true }); }
}
// TEST-01 / AC: losing an observed business error fails the live gate.
for (const status of [409, 422]) test(`removing createOrder ${status} fails coverage`, () => fixture(({ root, write, manifest, report }) => {
  write('testing/api/contracts/coverage-manifest.json', manifest);
  write('artifacts/contract-coverage.json', report); checkCoverage(root);
  report.results = report.results.filter(entry => entry.operationId !== 'createOrder' || entry.status !== status);
  write('artifacts/contract-coverage.json', report);
  assert.throws(() => checkCoverage(root), new RegExp(`createOrder:${status}`));
}));
test('new documented response requires an explicit decision', () => fixture(({ root, write, manifest, report }) => {
  manifest.operations.find(entry => entry.operationId === 'createOrder').excludedStatuses = [];
  write('testing/api/contracts/coverage-manifest.json', manifest); write('artifacts/contract-coverage.json', report);
  assert.throws(() => checkCoverage(root), /every documented status/);
}));
test('mock observations cannot satisfy the live gate', () => fixture(({ root, write, manifest, report }) => {
  report.source = 'checkout-faults'; write('testing/api/contracts/coverage-manifest.json', manifest); write('artifacts/contract-coverage.json', report);
  assert.throws(() => checkCoverage(root), /source or expected-spec digests/);
}));
