import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const services = ['catalog', 'customer', 'insights'];
function expectedOperations(read) {
  const expected = new Map();
  for (const service of services) {
    const doc = read(`contracts/bundled/${service}.json`);
    for (const [path, item] of Object.entries(doc.paths)) {
      for (const [method, operation] of Object.entries(item)) {
        const id = operation.operationId;
        if (!id || expected.has(id)) throw new Error(`Missing/duplicate operationId ${id}`);
        const statuses = Object.keys(operation.responses).map(Number);
        const success = statuses.find(status => status >= 200 && status < 300);
        if (!success) throw new Error(`${id}: missing success status`);
        expected.set(id, { service, method, path, baseline: [success, 400, 401, 403], documented: new Set(statuses) });
      }
    }
  }
  return expected;
}
function validateStatuses(entry, wanted) {
  const excluded = entry.excludedStatuses ?? [];
  const listed = [...entry.requiredStatuses, ...excluded.map(item => item.status)];
  const complete = new Set(listed).size === listed.length && listed.length === wanted.documented.size;
  if (!complete || !listed.every(status => wanted.documented.has(status))) throw new Error(`${entry.operationId}: every documented status must be required or explicitly excluded exactly once`);
  if (excluded.some(item => typeof item.reason !== 'string' || item.reason.length < 25 || wanted.baseline.includes(item.status))) throw new Error(`${entry.operationId}: invalid status exclusion`);
  for (const item of excluded) console.log(`EXCLUDED live ${entry.operationId}:${item.status}: ${item.reason}`);
}
function validateEntry(entry, wanted) {
  validateStatuses(entry, wanted);
  const identityMatches = entry.service === wanted.service && entry.method === wanted.method && entry.path === wanted.path;
  if (!identityMatches || !wanted.baseline.every(status => entry.requiredStatuses.includes(status))) throw new Error(`${entry.operationId}: manifest differs from canonical spec`);
}
function validateManifest(manifest, expected) {
  if (manifest.schemaVersion !== 1 || manifest.status !== 'live-provider-status-requirements-with-explicit-exclusions') throw new Error('Invalid live coverage manifest version/status');
  if (expected.size !== 23 || manifest.operations.length !== expected.size) throw new Error(`Operation count mismatch: ${manifest.operations.length}/${expected.size}`);
  const seen = new Set();
  for (const entry of manifest.operations) {
    const wanted = expected.get(entry.operationId);
    if (!wanted || seen.has(entry.operationId)) throw new Error(`Unknown/duplicate manifest operation ${entry.operationId}`);
    seen.add(entry.operationId);
    validateEntry(entry, wanted);
  }
}
function readReport(read, args) {
  const index = args.indexOf('--report');
  try { return read(index < 0 ? 'artifacts/contract-coverage.json' : args[index + 1]); }
  catch { throw new Error('No executed Playwright contract coverage report; live provider suites have not run'); }
}
function observedStatuses(report, digests, expected) {
  if (report.source !== 'playwright-contracts' || report.schemaVersion !== 1 || JSON.stringify(report.specDigests) !== JSON.stringify(digests.services)) throw new Error('Contract coverage report source or expected-spec digests differ');
  const covered = new Set();
  for (const result of report.results) {
    const wanted = expected.get(result.operationId);
    const validIdentity = wanted && result.service === wanted.service && wanted.documented.has(result.status);
    if (!validIdentity || typeof result.testId !== 'string' || result.testId.length < 4) throw new Error(`Invalid executed scenario ${result.operationId}:${result.status}`);
    covered.add(`${result.operationId}:${result.status}`);
  }
  return covered;
}
function selectedOperations(manifest, args) {
  const index = args.indexOf('--service');
  if (index < 0) return manifest.operations;
  const service = args[index + 1];
  if (!services.includes(service)) throw new Error('Expected --service catalog|customer|insights');
  return manifest.operations.filter(entry => entry.service === service);
}
function requireCoverage(operations, covered) {
  const uncovered = operations.flatMap(entry => entry.requiredStatuses.filter(status => !covered.has(`${entry.operationId}:${status}`)).map(status => `${entry.operationId}:${status}`));
  if (uncovered.length) throw new Error(`Live contract coverage incomplete (${uncovered.length} required statuses): ${uncovered.join(', ')}`);
  console.log(`PASS: all ${operations.length} selected operations have required executed Playwright status coverage`);
}
export function checkCoverage(root, args = []) {
  const read = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
  const manifest = read('testing/api/contracts/coverage-manifest.json');
  const expected = expectedOperations(read);
  validateManifest(manifest, expected);
  const operations = selectedOperations(manifest, args);
  if (args.includes('--inventory')) {
    const required = manifest.operations.reduce((total, entry) => total + entry.requiredStatuses.length, 0);
    console.log(`PASS: coverage manifest lists all ${expected.size} canonical operations and ${required} required status scenarios`);
    return;
  }
  requireCoverage(operations, observedStatuses(readReport(read, args), read('contracts/bundled/digests.json'), expected));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) checkCoverage(resolve(import.meta.dirname, '..'), process.argv.slice(2));
