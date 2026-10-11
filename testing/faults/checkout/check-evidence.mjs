import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const faultNames = ['unavailable', 'delay', 'malformed-json', 'invalid-quote', 'tls-boundary'];
function checkFault(item) {
  assert.equal(item.operationId, 'createOrder'); assert.equal(item.status, 503); assert.equal(item.recoveryStatus, 201);
  assert.equal(item.boundMs, 8000); assert.ok(item.elapsedMs >= 0 && item.elapsedMs < item.boundMs);
  if (item.fault === 'delay') assert.ok(item.elapsedMs >= 4500);
  for (const key of ['databaseTls', 'noPersistence', 'sameKeyRecovery', 'stableReplay', 'upstreamAuthorizedBeforeFault']) assert.equal(item[key], true);
}
function checkTls(item) {
  for (const key of ['verifiedDownstream', 'verifiedUpstream', 'missingTokenRejected', 'alteredTokenRejected', 'missingClientRejected', 'wrongClientCaRejected', 'wrongCallerRejected']) assert.equal(item[key], true);
}
export function checkEvidence(report, digests) {
  assert.equal(report.schemaVersion, 1); assert.equal(report.source, 'real-checkout-dependency-faults');
  assert.deepEqual(report.specDigests, digests);
  assert.ok(report.results.length >= 22); assert.ok(report.results.every(item => item.status === 'passed'));
  const faults = report.results.filter(item => item.group === 'checkout-faults');
  assert.equal(faults.length, faultNames.length);
  for (const name of faultNames) {
    const matches = faults.flatMap(item => item.evidence).filter(item => item.fault === name);
    assert.equal(matches.length, 1, `Missing or duplicate ${name}`);
    if (name === 'tls-boundary') checkTls(matches[0]); else checkFault(matches[0]);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = JSON.parse(readFileSync(`${process.env.LAB_FAULT_REPORT_DIR}/results.json`));
  const digests = JSON.parse(readFileSync('/work/contracts/bundled/digests.json')).services;
  checkEvidence(report, digests);
  console.log('PASS: real checkout 503 fault coverage, database invariants, TLS boundaries and recovery (5 cases); separate from live coverage');
}
