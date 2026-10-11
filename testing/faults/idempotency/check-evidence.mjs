import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export const scenarios = ['identical-race', 'conflicting-race', 'lost-response', 'tls-boundary'];
function common(item) {
  for (const key of ['oneOrder', 'requestHashMatched', 'stableReplay', 'databaseTls']) assert.equal(item[key], true);
  assert.equal(item.revisionDelta, 1);
  const db = item.database;
  assert.equal(db.beforeMatching, 0); assert.equal(db.afterMatching, 1);
  assert.ok(Number.isInteger(db.beforeTotal) && db.beforeTotal >= 0); assert.equal(db.afterTotal, db.beforeTotal + 1);
  assert.equal(BigInt(db.revisionAfter), BigInt(db.revisionBefore) + 1n);
}
function boundary(item) {
  for (const key of ['verifiedTls', 'wrongCaRejected', 'wrongHostnameRejected', 'missingClientRejected', 'wrongClientCaRejected', 'wrongCustomerRejected', 'missingTokenRejected', 'invalidTokenRejected', 'noPersistence']) assert.equal(item[key], true);
}
function scenario(item) {
  if (item.scenario === 'tls-boundary') { boundary(item); return; }
  common(item);
  if (item.scenario === 'identical-race') { assert.equal(item.observedBlockedInserts, 4); assert.deepEqual(item.statuses, [201, 201, 201, 201]); return; }
  assert.equal(item.conflictingReplay, 409);
  if (item.scenario === 'conflicting-race') { assert.equal(item.observedBlockedInserts, 2); assert.deepEqual(item.statuses, [201, 409]); return; }
  assert.equal(item.responseStarted, false); assert.equal(item.transportCode, 'ECONNRESET'); assert.equal(item.committedStatus, 201); assert.equal(item.retryStatus, 201);
}
export function checkEvidence(report, digests) {
  assert.equal(report.schemaVersion, 1); assert.equal(report.source, 'real-provider-checkout-idempotency'); assert.deepEqual(report.specDigests, digests);
  assert.equal(report.results.length, 21); assert.ok(report.results.every(item => item.status === 'passed'));
  const results = report.results.filter(item => item.group === 'checkout-idempotency'); assert.equal(results.length, 4);
  for (const name of scenarios) {
    const matches = results.flatMap(item => item.evidence).filter(item => item.scenario === name);
    assert.equal(matches.length, 1, `Missing or duplicate ${name}`); scenario(matches[0]);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  checkEvidence(JSON.parse(readFileSync(`${process.env.LAB_FAULT_REPORT_DIR}/results.json`)), JSON.parse(readFileSync('/work/contracts/bundled/digests.json')).services);
  console.log('PASS: TEST-08 observed insert races, committed response loss, stable replay, one-order database invariants and TLS boundary (4 cases)');
}
