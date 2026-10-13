import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkEvidence, faultNames } from './check-evidence.mjs';
function report() {
  const flags = { databaseTls: true, noPersistence: true, sameKeyRecovery: true, stableReplay: true, upstreamAuthorizedBeforeFault: true };
  const tls = { verifiedDownstream: true, verifiedUpstream: true, missingTokenRejected: true, alteredTokenRejected: true, missingClientRejected: true, wrongClientCaRejected: true, wrongCallerRejected: true };
  return { schemaVersion: 1, source: 'real-checkout-dependency-faults', specDigests: {}, results: [
    ...Array.from({ length: 17 }, () => ({ group: 'live-contracts', status: 'passed', evidence: [] })),
    ...faultNames.map(fault => ({ group: 'checkout-faults', status: 'passed', evidence: [{ fault, ...(fault === 'tls-boundary' ? tls : { ...flags, operationId: 'createOrder', status: 503, recoveryStatus: 201, elapsedMs: 5000, boundMs: 8000 }) }] }))
  ] };
}
// TEST-03 / AC: fault coverage requires actual 503 and complete recovery evidence.
test('missing or failed fault cannot satisfy the fault gate', () => {
  const value = report(); checkEvidence(value, {});
  value.results.pop(); assert.throws(() => checkEvidence(value, {}));
  const failed = report(); failed.results.at(-1).status = 'failed'; assert.throws(() => checkEvidence(failed, {}));
});
test('mock provenance and absent 503 cannot satisfy the fault gate', () => {
  const value = report(); value.source = 'mock-consumers'; assert.throws(() => checkEvidence(value, {}));
  const wrong = report(); wrong.results[17].evidence[0].status = 200; assert.throws(() => checkEvidence(wrong, {}));
});
test('persistence, timeout or recovery violations fail the fault gate', () => {
  for (const [key, value] of [['noPersistence', false], ['sameKeyRecovery', false], ['databaseTls', false], ['elapsedMs', 8000]]) {
    const invalid = report(); invalid.results[17].evidence[0][key] = value;
    assert.throws(() => checkEvidence(invalid, {}));
  }
});
