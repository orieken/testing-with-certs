import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkEvidence, scenarios } from './check-evidence.mjs';
function report() {
  const common = { database: { beforeTotal: 5, afterTotal: 6, beforeMatching: 0, afterMatching: 1, revisionBefore: '9', revisionAfter: '10' }, oneOrder: true, requestHashMatched: true, stableReplay: true, databaseTls: true, revisionDelta: 1 };
  const evidence = [
    { ...common, observedBlockedInserts: 4, statuses: [201, 201, 201, 201] },
    { ...common, observedBlockedInserts: 2, statuses: [201, 409], conflictingReplay: 409 },
    { ...common, responseStarted: false, transportCode: 'ECONNRESET', committedStatus: 201, retryStatus: 201, conflictingReplay: 409 },
    Object.fromEntries(['verifiedTls', 'wrongCaRejected', 'wrongHostnameRejected', 'missingClientRejected', 'wrongClientCaRejected', 'wrongCustomerRejected', 'missingTokenRejected', 'invalidTokenRejected', 'noPersistence'].map(key => [key, true]))
  ];
  return { schemaVersion: 1, source: 'real-provider-checkout-idempotency', specDigests: {}, results: [
    ...Array.from({ length: 17 }, () => ({ group: 'live-contracts', status: 'passed', evidence: [] })),
    ...scenarios.map((scenario, index) => ({ group: 'checkout-idempotency', status: 'passed', evidence: [{ scenario, ...evidence[index] }] }))
  ] };
}
test('TEST-08 gate rejects missing, failed, duplicate and mock evidence', () => {
  checkEvidence(report(), {});
  for (const mutate of [value => value.results.pop(), value => { value.results[17].status = 'failed'; }, value => { value.source = 'mock-consumers'; }, value => { value.results[18].evidence = value.results[17].evidence; }]) {
    const value = report(); mutate(value); assert.throws(() => checkEvidence(value, {}));
  }
});
test('TEST-08 gate rejects timing-only races and persistence/replay violations', () => {
  for (const [index, key, invalid] of [[17, 'observedBlockedInserts', 0], [17, 'oneOrder', false], [18, 'revisionDelta', 2], [18, 'conflictingReplay', 201], [19, 'responseStarted', true], [19, 'committedStatus', 503], [19, 'stableReplay', false], [20, 'verifiedTls', false]]) {
    const value = report(); value.results[index].evidence[0][key] = invalid; assert.throws(() => checkEvidence(value, {}));
  }
});
